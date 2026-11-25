import json, urllib.request, os
tok = 'vcp_REDACTED'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = []
skip = {'node_modules','.next','.vercel','.git','__pycache__','engine','.github'}
for base, dirs, names in os.walk(root):
    dirs[:] = [d for d in dirs if d not in skip]
    for n in names:
        if n.endswith('.log') or n.startswith('.env'): continue
        p = os.path.join(base, n)
        rel = os.path.relpath(p, root).replace(os.sep, '/')
        data = open(p, encoding='utf-8', errors='ignore').read()
        files.append({'file': rel, 'data': data})
print('files:', len(files))
payload = {'name': 'web', 'project': 'prj_mybaeapCVsT1BpmCyDoAp1l2wZbA', 'target': 'production', 'files': files}
req = urllib.request.Request(
    'https://api.vercel.com/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1&teamId=team_I1jfujieN7ofXAqLMLU4iRvh',
    data=json.dumps(payload).encode(), method='POST',
    headers={'Authorization': f'Bearer {tok}', 'Content-Type': 'application/json'})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=150).read())
    print('deployed:', d.get('url'), '| id:', (d.get('id') or '')[:24])
except Exception as e:
    print('ERR', e, getattr(e, 'read', lambda: b'')()[:300])
