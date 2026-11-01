use block2::Block;
use dispatch2::run_on_main;
use objc2::rc::Retained;
use objc2::{ClassType, MainThreadMarker, MainThreadOnly, Message};
use objc2_app_kit::{NSApplication, NSModalResponse, NSWindow};

use std::pin::Pin;
use std::sync::{Arc, Mutex};

use std::task::{Context, Poll, Waker};

use super::utils::activate_cocoa_multithreading;

pub(super) trait AsModal {
    fn inner_modal(&self) -> &(impl InnerModal + 'static);

    // File panels can explicitly finish their native lifecycle once their
    // selected paths have been copied. Other modal types keep their behavior.
    fn finish_modal(&self) {}
}

pub(super) trait InnerModal: ClassType + MainThreadOnly {
    fn begin_modal(&self, window: &NSWindow, handler: &Block<dyn Fn(NSModalResponse)>);
    fn run_modal(&self) -> NSModalResponse;
}

struct FutureState<R, D> {
    waker: Option<Waker>,
    data: Option<R>,
    modal: Option<D>,
}

unsafe impl<R, D> Send for FutureState<R, D> {}

pub(super) struct ModalFuture<R, D> {
    state: Arc<Mutex<FutureState<R, D>>>,
}

unsafe impl<R, D> Send for ModalFuture<R, D> {}

impl<R: 'static + Default, D: AsModal + 'static> ModalFuture<R, D> {
    pub fn new<F, DBULD: FnOnce(MainThreadMarker) -> D + Send>(
        win: Option<Retained<NSWindow>>,
        build_modal: DBULD,
        cb: F,
    ) -> Self
    where
        F: Fn(&mut D, isize) -> R + Send + 'static,
    {
        activate_cocoa_multithreading();

        let state = Arc::new(Mutex::new(FutureState {
            waker: None,
            data: None,
            modal: None,
        }));

        let dialog_callback = move |state: Arc<Mutex<FutureState<R, D>>>,
                                    result: NSModalResponse| {
            // Take ownership exactly once and unlock before calling AppKit:
            // closing the completed panel may re-enter native callbacks.
            let modal = { state.lock().unwrap().modal.take() };
            let Some(mut modal) = modal else {
                return;
            };
            let data = (cb)(&mut modal, result);
            modal.finish_modal();
            drop(modal);

            let mut state = state.lock().unwrap();
            state.data = Some(data);
            if let Some(waker) = state.waker.take() {
                waker.wake();
            }
        };

        let mtm = unsafe { MainThreadMarker::new_unchecked() };
        let app = NSApplication::sharedApplication(mtm);

        let win = if let Some(win) = win {
            Some(win)
        } else {
            unsafe { app.mainWindow() }.or_else(|| app.windows().firstObject())
        };

        // if async exec is possible start sheet modal
        // otherwise fallback to sync
        if unsafe { app.isRunning() } && win.is_some() {
            let state = state.clone();

            // Hack to work around us getting the window above
            struct WindowWrapper(Retained<NSWindow>);
            unsafe impl Send for WindowWrapper {}
            let window = WindowWrapper(win.unwrap());

            run_on_main(move |mtm| {
                let window = window;

                let completion = {
                    let state = state.clone();
                    block2::RcBlock::new(move |result| {
                        dialog_callback(state.clone(), result);
                    })
                };

                let modal = build_modal(mtm);
                let inner = modal.inner_modal().retain();

                state.lock().unwrap().modal = Some(modal);

                inner.begin_modal(&window.0, &completion);
            });
        } else {
            eprintln!("\n Hi! It looks like you are running async dialog in unsupported environment, I will fallback to sync dialog for you. \n");

            if let Some(mtm) = MainThreadMarker::new() {
                let modal = build_modal(mtm);
                let inner = modal.inner_modal().retain();

                state.lock().unwrap().modal = Some(modal);

                let ret = inner.run_modal();

                dialog_callback(state.clone(), ret);
            } else {
                panic!("Fallback Sync Dialog Must Be Spawned On Main Thread (Why? If async dialog is unsupported in this env, it also means that spawning dialogs outside of main thread is also inpossible");
            }
        }

        Self { state }
    }
}

impl<R, D> std::future::Future for ModalFuture<R, D> {
    type Output = R;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let mut state = self.state.lock().unwrap();

        if state.data.is_some() {
            Poll::Ready(state.data.take().unwrap())
        } else {
            state.waker = Some(cx.waker().clone());
            Poll::Pending
        }
    }
}
