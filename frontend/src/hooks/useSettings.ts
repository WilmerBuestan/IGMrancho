import { useEffect, useState } from 'react';
import { AdminSettings, api } from '../api';

/** Carga los ajustes del admin y permite guardar solo una parte de ellos. */
export function useSettings() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<AdminSettings>('/admin/settings', {}, true).then(setSettings).catch((e) => setMsg(e.message));
  }, []);

  async function save(patch: Partial<AdminSettings>) {
    setSaving(true);
    setMsg('');
    try {
      setSettings(await api<AdminSettings>('/admin/settings', { method: 'PUT', body: JSON.stringify(patch) }, true));
      setMsg('✓ Cambios guardados');
      setTimeout(() => setMsg(''), 3000);
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { settings, setSettings, save, saving, msg, setMsg };
}
