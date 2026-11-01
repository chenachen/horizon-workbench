//! AppKit termination is separate from Tauri's event-loop exit request.
//! Cocoa's delegate must veto Cmd-Q, the app menu and Dock Quit until the
//! same host close plan has finished saving documents and reaping resources.

#[cfg(target_os="macos")]
mod implementation {
    use crate::{HostError,HostState};
    use std::{ffi::{c_char,c_void},sync::{atomic::Ordering,Arc,OnceLock,Weak}};
    use tauri::AppHandle;

    static HOST:OnceLock<(AppHandle,Weak<HostState>)>=OnceLock::new();
    #[link(name="objc")]
    extern "C" {
        fn objc_getClass(name:*const c_char)->*mut c_void;
        fn sel_registerName(name:*const c_char)->*const c_void;
        fn objc_msgSend();
        fn object_getClass(object:*mut c_void)->*mut c_void;
        fn class_addMethod(class:*mut c_void,selector:*const c_void,implementation:extern "C" fn(*mut c_void,*const c_void,*mut c_void)->usize,types:*const c_char)->i8;
    }

    extern "C" fn should_terminate(_delegate:*mut c_void,_selector:*const c_void,_application:*mut c_void)->usize {
        // Do not unwind across the Objective-C ABI. Failure keeps the app open.
        std::panic::catch_unwind(||{
            let Some((app,weak))=HOST.get()else{return 0};let Some(state)=weak.upgrade()else{return 0};
            if state.shutdown_allowed.load(Ordering::SeqCst){return 1;}
            crate::request_close(app);
            0
        }).unwrap_or(0)
    }

    pub fn install(app:&AppHandle,state:&Arc<HostState>)->Result<(),HostError>{
        if HOST.get().is_some(){return Ok(());}
        unsafe{
            // These two selectors take no explicit arguments and return an object.
            let send:unsafe extern "C" fn(*mut c_void,*const c_void)->*mut c_void=std::mem::transmute(objc_msgSend as *const ());
            let application=send(objc_getClass(c"NSApplication".as_ptr()),sel_registerName(c"sharedApplication".as_ptr()));
            let delegate=send(application,sel_registerName(c"delegate".as_ptr()));
            if delegate.is_null(){return Err(HostError::new("DEPENDENCY_UNAVAILABLE","无法安装macOS退出数据保护"));}
            let class=object_getClass(delegate);
            // NSApplicationTerminateReply is NSUInteger on the supported 64-bit Macs.
            if class_addMethod(class,sel_registerName(c"applicationShouldTerminate:".as_ptr()),should_terminate,c"Q@:@".as_ptr())==0{
                return Err(HostError::new("DEPENDENCY_UNAVAILABLE","macOS退出委托已被其他组件占用"));
            }
            let _=HOST.set((app.clone(),Arc::downgrade(state)));
            // Refresh AppKit's optional delegate-method cache after adding the method.
            let set_delegate:unsafe extern "C" fn(*mut c_void,*const c_void,*mut c_void)=std::mem::transmute(objc_msgSend as *const ());
            set_delegate(application,sel_registerName(c"setDelegate:".as_ptr()),std::ptr::null_mut());
            set_delegate(application,sel_registerName(c"setDelegate:".as_ptr()),delegate);
        }
        Ok(())
    }
}

#[cfg(target_os="macos")]
pub use implementation::install;

#[cfg(not(target_os="macos"))]
pub fn install(_app:&tauri::AppHandle,_state:&std::sync::Arc<crate::HostState>)->Result<(),crate::HostError>{Ok(())}
