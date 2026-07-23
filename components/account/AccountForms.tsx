'use client';

import { useEffect, useState } from 'react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';

type Profile = {
  name: string;
  email: string;
  locale: string;
  image: string | null;
};
type Preferences = {
  personalizationEnabled: boolean;
  explicitContentAllowed: boolean;
  selectedMoods: string[];
  useCases: string[];
};

const moods = ['Tập trung', 'Thư giãn', 'Năng lượng', 'Hoài niệm', 'Đêm khuya'];
const useCases = ['Làm việc', 'Tập luyện', 'Đi đường', 'Tiệc nhỏ'];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('REQUEST_FAILED');
  return body as T;
}

export function ProfileForm() {
  const { generation } = useAuthSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    void api<{ profile: Profile }>('/api/profile')
      .then(({ profile: value }) => {
        setProfile(value);
        setName(value.name);
      })
      .catch(() => setStatus('Không thể tải hồ sơ.'));
  }, [generation]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('Đang lưu…');
    try {
      const result = await api<{ profile: Profile }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setProfile(result.profile);
      setStatus('Đã lưu');
    } catch {
      setStatus('Chưa thể lưu thay đổi.');
    }
  };
  if (!profile)
    return (
      <div className="account-loading" role="status">
        Đang tải hồ sơ…
      </div>
    );
  return (
    <form className="account-form" onSubmit={save}>
      <div className="account-form__field">
        <label htmlFor="profile-name">Tên hiển thị</label>
        <input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
      </div>
      <div className="account-form__readonly">
        <span>Email</span>
        <strong>{profile.email}</strong>
        <small>Email được quản lý bởi phương thức đăng nhập của bạn.</small>
      </div>
      <div className="account-form__field">
        <label htmlFor="profile-locale">Ngôn ngữ</label>
        <select id="profile-locale" defaultValue={profile.locale}>
          <option value="vi-VN">Tiếng Việt</option>
          <option value="en-US">English</option>
        </select>
      </div>
      <div className="account-form__actions">
        <button className="account-primary" type="submit">
          Lưu thay đổi
        </button>
        <span role="status">{status}</span>
      </div>
    </form>
  );
}

export function PreferencesForm() {
  const { generation } = useAuthSession();
  const [preferences, setPreferences] = useState<Preferences>({
    personalizationEnabled: true,
    explicitContentAllowed: true,
    selectedMoods: [],
    useCases: [],
  });
  const [status, setStatus] = useState('');
  useEffect(() => {
    void api<{ preferences: Preferences }>('/api/preferences')
      .then(({ preferences: value }) => setPreferences(value))
      .catch(() => setStatus('Không thể tải sở thích.'));
  }, [generation]);
  const toggle = (key: 'selectedMoods' | 'useCases', value: string) =>
    setPreferences((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  const save = async () => {
    setStatus('Đang lưu…');
    try {
      await api('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      });
      setStatus('Đã lưu');
    } catch {
      setStatus('Chưa thể lưu thay đổi.');
    }
  };
  return (
    <div className="account-form">
      <label className="account-toggle">
        <span>
          <strong>Cá nhân hóa trang chủ</strong>
          <small>
            Dùng lịch sử nghe để gợi ý phù hợp hơn. Bạn có thể tắt bất cứ lúc
            nào.
          </small>
        </span>
        <input
          type="checkbox"
          checked={preferences.personalizationEnabled}
          onChange={(e) =>
            setPreferences({
              ...preferences,
              personalizationEnabled: e.target.checked,
            })
          }
        />
      </label>
      <label className="account-toggle">
        <span>
          <strong>Nội dung nhạy cảm</strong>
          <small>Cho phép nội dung được phân loại rõ ràng.</small>
        </span>
        <input
          type="checkbox"
          checked={preferences.explicitContentAllowed}
          onChange={(e) =>
            setPreferences({
              ...preferences,
              explicitContentAllowed: e.target.checked,
            })
          }
        />
      </label>
      <fieldset>
        <legend>Tâm trạng yêu thích</legend>
        <div className="account-chips">
          {moods.map((mood) => (
            <button
              type="button"
              key={mood}
              className={
                preferences.selectedMoods.includes(mood)
                  ? 'account-chip account-chip--active'
                  : 'account-chip'
              }
              onClick={() => toggle('selectedMoods', mood)}
            >
              {mood}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Thường nghe khi</legend>
        <div className="account-chips">
          {useCases.map((item) => (
            <button
              type="button"
              key={item}
              className={
                preferences.useCases.includes(item)
                  ? 'account-chip account-chip--active'
                  : 'account-chip'
              }
              onClick={() => toggle('useCases', item)}
            >
              {item}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="account-form__actions">
        <button className="account-primary" type="button" onClick={save}>
          Lưu sở thích
        </button>
        <span role="status">{status}</span>
      </div>
    </div>
  );
}
