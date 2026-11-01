import sys,json,time,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'scripts/desktop'))
from mac_metrics import MacMetrics,select_processes
m=MacMetrics();base=Path(sys.argv[2]);root_pid=int(sys.argv[1]);known={};background_known={};first={};start=time.monotonic();n=0;roots={root_pid};patterns=('openAndSavePanelService','QuickLookUIService','SafariPlatformSupport.Helper','PanelLifetimeProbe')
with (base/'identity-observation.jsonl').open('w') as f:
 while True:
  now=time.monotonic();ps=m.processes();selected,_=select_processes(ps,roots,{},known,m);background_selected,_=select_processes(ps,{34128},{},background_known,m);pids=set(selected)|set(background_selected)|({34128} if 34128 in ps else set())|{pid for pid,p in ps.items() if any(x in p['executable'] for x in patterns)}
  pids|={pid for (pid,started) in first if pid in ps and ps[pid]['start']==started}
  details=[]
  for pid in sorted(pids):
   p=ps[pid];key=(pid,p['start']);resp=m.responsible_pid(pid);first.setdefault(key,{'firstElapsedSeconds':round(now-start,4),'firstResponsiblePid':resp});details.append({**m.read(p,now),'responsible_pid':resp,'attribution':({**selected[pid],'group':'probe'} if pid in selected else {**background_selected[pid],'group':'horizon-existing'} if pid in background_selected else None),'firstObservation':first[key]})
  absent=[{'pid':pid,'start':started,**data} for (pid,started),data in first.items() if pid not in ps or ps[pid]['start']!=started]
  row={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(now-start,4),'parentPresent':root_pid in ps,'processes':details,'absentIdentities':absent};f.write(json.dumps(row,ensure_ascii=False)+'\n');f.flush();n+=1
  if (base/'stop-observation').exists() or now-start>=(float(sys.argv[3]) if len(sys.argv)>3 else 300):break
  time.sleep(1)
print(json.dumps({'samples':n,'observedSeconds':time.monotonic()-start,'identities':len(first),'parentPresentAtEnd':row['parentPresent'],'method':'identity/liveness observation,notfixed125sidleCPUbudget'}))
