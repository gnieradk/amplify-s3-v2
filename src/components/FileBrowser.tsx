import React from 'react';
import { uploadData, list, getUrl, remove } from 'aws-amplify/storage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type Item = {
  path: string;
  size?: number;
  lastModified?: string | number | Date;
};

function pathJoin(...parts: string[]) {
  return parts.join('/').replace(/\/+/, '/').replace(/\/+$/, '/');
}

function toBreadcrumbs(path: string) {
  const segs = path.replace(/\/+$/, '').split('/').filter(Boolean);
  const crumbs: { name: string; path: string }[] = [];
  let acc = '';
  for (const s of segs) {
    acc = acc ? acc + '/' + s : s;
    crumbs.push({ name: s, path: acc + '/' });
  }
  return crumbs;
}

export default function FileBrowser() {
  const [currentPath, setCurrentPath] = React.useState<string>('shared/');
  const [items, setItems] = React.useState<Item[]>([]);
  const [folders, setFolders] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    refresh(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  async function refresh(prefix: string) {
    try {
      setLoading(true);
      setError(null);
      const resp = await list({ path: prefix, options: { listAll: true } });
      const files: Item[] = [];
      const dirSet = new Set<string>();
      for (const it of resp.items ?? []) {
        const rest = it.path.slice(prefix.length);
        const nextSlash = rest.indexOf('/');
        if (nextSlash >= 0) {
          const folderName = rest.slice(0, nextSlash);
          if (folderName) dirSet.add(folderName);
        } else if (rest.length) {
          files.push({ path: it.path, size: (it as any).size, lastModified: (it as any).lastModified });
        }
      }
      setFolders(Array.from(dirSet).sort());
      setItems(files.sort((a, b) => a.path.localeCompare(b.path)));
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function openFolder(name: string) {
    setCurrentPath(pathJoin(currentPath, name) + '/');
  }

  function goUp() {
    const parts = currentPath.replace(/\/+$/, '').split('/');
    if (parts.length <= 1) return;
    const parent = parts.slice(0, -1).join('/') + '/';
    setCurrentPath(parent);
  }

  async function createFolder() {
    const name = prompt('Folder name');
    if (!name) return;
    const marker = new Blob([''], { type: 'text/plain' });
    const markerKey = pathJoin(currentPath, name, '.keep');
    await uploadData({ path: markerKey, data: marker }).result;
    await refresh(currentPath);
  }

  async function onFileInput(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files || []);
    for (const f of files) {
      await uploadData({ path: currentPath + f.name, data: f }).result;
    }
    await refresh(currentPath);
    (ev.target as HTMLInputElement).value = '';
  }

  // Drag & drop handling (files + folders)
  async function handleEntry(entry: any, basePath: string) {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(async (file: File) => {
          await uploadData({ path: basePath + file.name, data: file }).result;
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries: any[] = await new Promise((resolve) => reader.readEntries(resolve));
      for (const ent of entries) {
        await handleEntry(ent, basePath + entry.name + '/');
      }
    }
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const items = e.dataTransfer.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      const entry = (it as any).webkitGetAsEntry?.();
      if (entry) {
        await handleEntry(entry, currentPath);
      } else if ((it as any).getAsFile) {
        const file = (it as any).getAsFile();
        if (file) await uploadData({ path: currentPath + file.name, data: file }).result;
      }
    }
    await refresh(currentPath);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function download(p: string) {
    const url = await getUrl({ path: p, options: { validateObjectExistence: true } });
    window.open(url.url.toString(), '_blank');
  }

  async function del(p: string) {
    if (!confirm('Delete this file?')) return;
    await remove({ path: p });
    await refresh(currentPath);
  }

  async function downloadFolder(prefix: string) {
    try {
      setLoading(true);
      const resp = await list({ path: prefix, options: { listAll: true } });
      const zip = new JSZip();
      for (const it of resp.items ?? []) {
        const url = await getUrl({ path: it.path });
        const blob = await fetch(url.url).then((r) => r.blob());
        const relativeName = it.path.substring(prefix.length);
        zip.file(relativeName, blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, prefix.replace(/\/$/, '') + '.zip');
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const crumbs = toBreadcrumbs(currentPath);

  return (
    <div style={{marginTop: 16}}>
      <div style={{display:'flex', gap:12, alignItems:'center'}}>
        <strong>Location:</strong>
        <button onClick={() => setCurrentPath('shared/')}>shared/</button>
        <span style={{marginLeft:12, opacity:0.8}}>
          {crumbs.map((c, i) => (
            <span key={c.path}>
              <a href="#" onClick={(e) => {e.preventDefault(); setCurrentPath(c.path);}}>{c.name}</a>
              {i < crumbs.length - 1 ? ' / ' : ''}
            </span>
          ))}
        </span>
      </div>

      <div style={{display:'flex', gap:8, marginTop:12, alignItems:'center'}}>
        <input type="file" multiple onChange={onFileInput} />
        <button onClick={createFolder}>New folder</button>
        <button onClick={goUp}>Up</button>
        <button onClick={() => refresh(currentPath)} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        <button onClick={() => downloadFolder(currentPath)}>Download folder</button>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        style={{border:'2px dashed #aaa', padding:20, textAlign:'center', marginTop:12, borderRadius:8}}
      >
        Drag & drop files or folders here
      </div>

      {error && <div style={{color:'crimson', marginTop:8}}>Error: {error}</div>}

      <div style={{display:'grid', gridTemplateColumns:'1fr', gap:6, marginTop:16}}>
        {folders.length > 0 && (
          <div style={{border:'1px solid #ddd', borderRadius:8, padding:8}}>
            <div style={{fontWeight:600, marginBottom:6}}>Folders</div>
            <ul style={{margin:0, paddingLeft:18}}>
              {folders.map((f) => (
                <li key={f}><a href="#" onClick={(e)=>{e.preventDefault(); openFolder(f);}}>📁 {f}/</a></li>
              ))}
            </ul>
          </div>
        )}

        <div style={{border:'1px solid #ddd', borderRadius:8, padding:8}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontWeight:600}}>Files</div>
            <div style={{opacity:0.7}}>{items.length} items</div>
          </div>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px 4px'}}>Name</th>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px 4px'}}>Size</th>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px 4px'}}>Modified</th>
                <th style={{textAlign:'left', borderBottom:'1px solid #eee', padding:'6px 4px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const name = it.path.substring(currentPath.length);
                return (
                  <tr key={it.path}>
                    <td style={{padding:'6px 4px'}}>{name}</td>
                    <td style={{padding:'6px 4px'}}>{it.size ?? ''}</td>
                    <td style={{padding:'6px 4px'}}>{it.lastModified ? new Date(it.lastModified).toLocaleString() : ''}</td>
                    <td style={{padding:'6px 4px', display:'flex', gap:8}}>
                      <button onClick={() => download(it.path)}>Download</button>
                      <button onClick={() => del(it.path)} style={{color:'crimson'}}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
