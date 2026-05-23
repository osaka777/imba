"use client";

import { useEffect, useState } from "react";
import { bannersAPI, type CreateBannerData, type UpdateBannerData } from "@/shared/api/banners";
import { Button } from "@/widgets/Button";
import { Input } from "@/widgets/Input";

// Legacy tag stripping helper (do not save tags anymore)
function stripPromoTags(desc?: string) {
  return (desc || "").replace(/\s*\[PROMO:[^\]]+\]\s*/g, "").trim();
}

export function PromoBannersEditor() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banners, setBanners] = useState<Array<{ id: number; title: string; description?: string; linkUrl?: string; imagePath?: string; isActive: boolean; order: number }>>([]);

  const [bibika, setBibika] = useState<{ id?: number; title: string; description: string; linkUrl: string; imagePath: string; isActive: boolean; order: number; uploading: boolean }>({ title: "", description: "", linkUrl: "", imagePath: "", isActive: true, order: 1, uploading: false });
  const [bonus, setBonus] = useState<{ id?: number; title: string; description: string; linkUrl: string; imagePath: string; isActive: boolean; order: number; uploading: boolean }>({ title: "", description: "", linkUrl: "", imagePath: "", isActive: true, order: 2, uploading: false });
  // Единая форма создания нового баннера
  const [draft, setDraft] = useState<{ title: string; description: string; linkUrl: string; imagePath: string; isActive: boolean; order: number; uploading: boolean }>({ title: "", description: "", linkUrl: "", imagePath: "", isActive: true, order: 999, uploading: false });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await bannersAPI.getAllBanners();
        setBanners(list);
        // Prefer by order: 1 for Bibika, 2 for Bonus
        const b1 = list.find(b => b.order === 1) || null;
        const b2 = list.find(b => b.order === 2) || null;
        if (b1) setBibika({ id: b1.id, title: b1.title, description: stripPromoTags(b1.description), linkUrl: b1.linkUrl || "", imagePath: b1.imagePath || "", isActive: b1.isActive, order: 1, uploading: false });
        if (b2) setBonus({ id: b2.id, title: b2.title, description: stripPromoTags(b2.description), linkUrl: b2.linkUrl || "", imagePath: b2.imagePath || "", isActive: b2.isActive, order: 2, uploading: false });
      } catch (e) {
        setError("Ошибка загрузки промо-баннеров");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reloadBanners = async () => {
    try {
      const list = await bannersAPI.getAllBanners();
      setBanners(list);
      // refresh promo previews by order
      const p1 = list.find(b => b.order === 1) || null;
      const p2 = list.find(b => b.order === 2) || null;
      if (p1) setBibika({ id: p1.id, title: p1.title, description: stripPromoTags(p1.description), linkUrl: p1.linkUrl || "", imagePath: p1.imagePath || "", isActive: p1.isActive, order: 1, uploading: false });
      if (p2) setBonus({ id: p2.id, title: p2.title, description: stripPromoTags(p2.description), linkUrl: p2.linkUrl || "", imagePath: p2.imagePath || "", isActive: p2.isActive, order: 2, uploading: false });
    } catch {}
  };

  const uploadDraft = async (file: File) => {
    try {
      setDraft(s => ({ ...s, uploading: true }));
      const res = await bannersAPI.uploadBannerImage(file);
      setDraft(s => ({ ...s, imagePath: res.path, uploading: false }));
    } catch (e) {
      setError("Ошибка загрузки изображения");
      setDraft(s => ({ ...s, uploading: false }));
    }
  };

  const createBanner = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: CreateBannerData = {
        title: draft.title,
        description: draft.description,
        imagePath: draft.imagePath || undefined,
        linkUrl: draft.linkUrl || undefined,
        isActive: !!draft.isActive,
        order: draft.order || 999,
        textShadow: true,
        titleColor: "#ffffff",
        descColor: "#ffffff",
        titleSize: 28,
        descSize: 13,
      };
      await bannersAPI.createBanner(payload);
      setDraft({ title: "", description: "", linkUrl: "", imagePath: "", isActive: true, order: 999, uploading: false });
      await reloadBanners();
    } catch (e) {
      setError("Ошибка создания баннера");
    } finally {
      setLoading(false);
    }
  };

  const setAsPromo = async (slot: 1 | 2, bannerId: number) => {
    setLoading(true);
    try {
      const current = banners.find(b => b.order === slot);
      if (current && current.id !== bannerId) {
        await bannersAPI.updateBanner(current.id, { order: 999 });
      }
      await bannersAPI.updateBanner(bannerId, { order: slot });
      await reloadBanners();
    } catch {
      setError('Не удалось назначить промо-баннер');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (bannerId: number) => {
    try {
      await bannersAPI.toggleBannerStatus(bannerId);
      await reloadBanners();
    } catch {
      setError('Не удалось изменить статус баннера');
    }
  };

  const removeBanner = async (bannerId: number) => {
    if (!confirm('Удалить баннер?')) return;
    try {
      await bannersAPI.deleteBanner(bannerId);
      await reloadBanners();
    } catch {
      setError('Не удалось удалить баннер');
    }
  };

  const upload = async (file: File, which: "bibika" | "bonus") => {
    try {
      which === "bibika" ? setBibika(s => ({ ...s, uploading: true })) : setBonus(s => ({ ...s, uploading: true }));
      const res = await bannersAPI.uploadBannerImage(file);
      which === "bibika" ? setBibika(s => ({ ...s, imagePath: res.path, uploading: false })) : setBonus(s => ({ ...s, imagePath: res.path, uploading: false }));
    } catch (e) {
      setError("Ошибка загрузки изображения");
      which === "bibika" ? setBibika(s => ({ ...s, uploading: false })) : setBonus(s => ({ ...s, uploading: false }));
    }
  };

  const save = async (data: typeof bibika) => {
    setLoading(true);
    setError(null);
    try {
      const base: CreateBannerData | UpdateBannerData = {
        title: data.title || "",
        description: data.description || "",
        imagePath: data.imagePath || undefined,
        linkUrl: data.linkUrl || undefined,
        isActive: !!data.isActive,
        order: data.order || 1,
        textShadow: true,
        titleColor: "#ffffff",
        descColor: "#ffffff",
        titleSize: 28,
        descSize: 13,
      };
      if (data.id) {
        await bannersAPI.updateBanner(data.id, base as UpdateBannerData);
      } else {
        await bannersAPI.createBanner(base as CreateBannerData);
      }
    } catch (e) {
      setError("Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Промо баннеры (BonusBibika / BonusBonus)</h2>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Bibika */}
        <section className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="text-lg font-medium mb-3">Создать баннер</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Заголовок" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <Input label="Ссылка" value={draft.linkUrl} onChange={e => setDraft({ ...draft, linkUrl: e.target.value })} />
            <Input label="Описание" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            <Input label="Порядок" type="number" value={draft.order} onChange={e => setDraft({ ...draft, order: parseInt(e.target.value) || 999 })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Изображение</label>
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDraft(f); }} />
              {draft.uploading && <span className="text-blue-600 ml-2">Загрузка...</span>}
              {draft.imagePath && <span className="text-gray-600 ml-2">{draft.imagePath}</span>}
            </div>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} />
              <span>Активен</span>
            </label>
          </div>
          <div className="mt-3">
            <Button onClick={createBanner} className="bg-green-600 hover:bg-green-700 text-white">Создать</Button>
          </div>
        </section>

        {/* Удалены отдельные секции BonusBibika/BonusBonus. Ниже выбираем любые два баннера: назначьте "Promo #1" и "Promo #2". */}

        {/* Список всех баннеров с действиями выбора промо */}
        <section className="bg-white border border-gray-200 rounded-md p-4">
          <h3 className="text-lg font-medium mb-3">Все баннеры</h3>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Заголовок</th>
                  <th className="py-2 pr-3">Порядок</th>
                  <th className="py-2 pr-3">Статус</th>
                  <th className="py-2 pr-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {banners.map(b => (
                  <tr key={b.id} className="border-b">
                    <td className="py-2 pr-3">{b.id}</td>
                    <td className="py-2 pr-3">{b.title}</td>
                    <td className="py-2 pr-3">{b.order}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {b.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 space-x-2">
                      <Button onClick={() => setAsPromo(1, b.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1">Назначить Promo #1</Button>
                      <Button onClick={() => setAsPromo(2, b.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1">Назначить Promo #2</Button>
                      <Button onClick={() => toggleActive(b.id)} className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-2 py-1">{b.isActive ? 'Выключить' : 'Включить'}</Button>
                      <Button onClick={() => removeBanner(b.id)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1">Удалить</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {loading && <div className="text-gray-600 mt-3">Загрузка...</div>}
    </div>
  );
}
