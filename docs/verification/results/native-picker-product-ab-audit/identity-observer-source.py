"""Read-only native picker lifecycle observation; start only on root's GUI handoff."""
import datetime, json, sys, time
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'scripts/desktop'))
from mac_metrics import MacMetrics,select_processes

root_pid=int(sys.argv[1]);base=Path(sys.argv[2]);duration=float(sys.argv[3]) if len(sys.argv)>3 else 600
base.mkdir(parents=True,exist_ok=False)
metrics=MacMetrics();initial=metrics.processes()
if root_pid not in initial:raise SystemExit('Root absent before lifecycle observation')
root_start=initial[root_pid]['start'];known={};observed={};start=time.monotonic();n=0
patterns=('openAndSavePanelService','QuickLookUIService','SafariPlatformSupport.Helper','HorizonPicker','horizon-picker')
with (base/'identity-observation.jsonl').open('w') as stream:
 while True:
  now=time.monotonic();processes=metrics.processes()
  root_present=root_pid in processes and processes[root_pid]['start']==root_start
  selected,unassigned=select_processes(processes,{root_pid} if root_present else set(),{},known,metrics)
  candidates={pid for pid,p in processes.items() if any(part in p['executable'] for part in patterns)}
  retained={pid for (pid,started) in observed if pid in processes and processes[pid]['start']==started}
  rows=[]
  for pid in sorted(set(selected)|candidates|retained):
   p=processes[pid];identity=(pid,p['start']);responsible=metrics.responsible_pid(pid)
   observation=observed.setdefault(identity,{'firstElapsedSeconds':round(now-start,4),'firstResponsiblePid':responsible,'presentAtBaseline':n==0,'everAttributedToRoot':False})
   if pid in selected:observation['everAttributedToRoot']=True
   rows.append({**metrics.read(p,now),'responsible_pid':responsible,'attribution':selected.get(pid),'identityObservation':dict(observation)})
  missing=[{'pid':pid,'start':started,**value} for (pid,started),value in observed.items() if pid not in processes or processes[pid]['start']!=started]
  row={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':round(now-start,4),'rootPid':root_pid,'rootStart':root_start,'rootPresent':root_present,'processes':rows,'absentIdentities':missing,'unassignedWebKit':unassigned}
  stream.write(json.dumps(row,ensure_ascii=False)+'\n');stream.flush();n+=1
  if (base/'stop-observation').exists() or now-start>=duration:break
  time.sleep(1)
summary={'samples':n,'observedSeconds':time.monotonic()-start,'identities':len(observed),'rootPresentAtEnd':row['rootPresent'],'remainingAttributedIdentities':[{'pid':r['pid'],'start':r['start'],'executable':r['executable'],'responsible_pid':r['responsible_pid']} for r in row['processes'] if r['identityObservation']['everAttributedToRoot']],'limits':['Identity/liveness observation,notfixedCPUbudget.','One-second scans may miss shorterlivedidentities.','Newunattributedservicecandidates retained,notautomaticallychargedtoHorizon.']}
(base/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False))
