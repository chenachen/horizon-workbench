import json, pathlib, subprocess, tempfile
root = pathlib.Path(tempfile.mkdtemp(prefix="horizon-workspace-final-"))
def git(directory, *args):
    return subprocess.run(["git", "-C", str(directory), *args], check=True, text=True, capture_output=True).stdout.strip()
plain=root/"scripts-no-auto-run"
plain.mkdir()
(plain/"README.md").write_text("# Workspace final acceptance\nOwned disposable project.\n",encoding="utf-8")
(plain/"marker.cjs").write_text("require('node:fs').writeFileSync(require('node:path').join(__dirname, '.unexpected-execution'), 'UNEXPECTED_EXECUTION')\n")
(plain/"package.json").write_text(json.dumps({"name":"horizon-workspace-disposable", "version":"1.0.0", "private":True, "scripts":{"dev":"node marker.cjs", "postinstall":"node marker.cjs"}},indent=2)+"\n")
git(plain,"init","-b","main")
git(plain,"config","user.name","Horizon QA")
git(plain,"config","user.email","horizon-qa@example.invalid")
git(plain,"add","README.md","package.json","marker.cjs")
git(plain,"-c","core.hooksPath=/dev/null","-c","commit.gpgsign=false","commit","-m","Disposable workspace fixture")
remote=root/"scripted-remote.git"
subprocess.run(["git","clone","--bare",str(plain),str(remote)],check=True,capture_output=True)
alias=root/"same-project-alias"
alias.symlink_to(plain,target_is_directory=True)
relocatable=root/"relocatable-project"
relocatable.mkdir();(relocatable/"keep.txt").write_text("HORIZON_WORKSPACE_RELOCATE_KEEP\n")
readonly=root/"readonly-project"
readonly.mkdir();(readonly/"read-only.txt").write_text("HORIZON_WORKSPACE_READ_ONLY\n")
(readonly/"read-only.txt").chmod(0o444);readonly.chmod(0o555)
denied=root/"denied-project"
denied.mkdir();(denied/"keep.txt").write_text("HORIZON_WORKSPACE_DENIED_KEEP\n");denied.chmod(0)
parent=root/"parent-repository";parent.mkdir();(parent/"root.txt").write_text("HORIZON_PARENT_ROOT\n")
child=parent/"nested-directory";child.mkdir();(child/"child.txt").write_text("HORIZON_NESTED_DIRECTORY\n")
git(parent,"init","-b","main");git(parent,"config","user.name","Horizon QA");git(parent,"config","user.email","horizon-qa@example.invalid");git(parent,"add",".");git(parent,"-c","core.hooksPath=/dev/null","-c","commit.gpgsign=false","commit","-m","Disposable parent fixture")
worktree=root/"linked-worktree"
git(parent,"-c","core.hooksPath=/dev/null","worktree","add","-b","qa-worktree",str(worktree))
manifest={"root":str(root),"createdFor":"W1/W2 actual GUI only; creation is not acceptance", "paths":{ "scriptedProject":str(plain),"scriptedRemote":str(remote),"sameProjectAlias":str(alias),"relocatable":str(relocatable),"relocatedTarget":str(root/"relocated-project"),"readonly":str(readonly),"denied":str(denied),"parentRepo":str(parent),"nestedFolder":str(child),"worktree":str(worktree)},"unexpectedMarkerExists":(plain/".unexpected-execution").exists(),"scriptedHead":git(plain,"rev-parse","HEAD"),"parentHead":git(parent,"rev-parse","HEAD"),"cleanup":"Restore denied 0700, readonly 0755/read-only.txt0644 before cleanup; do not remove registered project sources during tests."}
assert not manifest["unexpectedMarkerExists"]
pathlib.Path(".work/workspace-final-fixture.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(manifest,ensure_ascii=False))
