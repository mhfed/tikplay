'use client';

import { useState } from 'react';
import { CheckIcon, SpinnerIcon } from './icons';

const fieldClass =
  'mt-1.5 w-full rounded-control border border-line bg-canvas px-3.5 py-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]';

export default function CopyrightReportForm() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch('/api/copyright-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: data.get('sourceUrl'),
          reporterName: data.get('reporterName'),
          reporterEmail: data.get('reporterEmail'),
          rightsBasis: data.get('rightsBasis'),
          details: data.get('details'),
          declaration: data.get('declaration') === 'on',
          website: data.get('website'),
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        reportId?: number;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Không thể gửi báo cáo');
      }

      form.reset();
      setMessage({
        type: 'success',
        text: `Báo cáo #${result.reportId} đã được ghi nhận. Chúng tôi sẽ xem xét thông tin bạn cung cấp.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: (error as Error).message || 'Không thể gửi báo cáo',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} />
      </div>

      <label className="block text-sm font-semibold text-ink">
        Liên kết nội dung bị báo cáo
        <input
          className={fieldClass}
          name="sourceUrl"
          type="url"
          maxLength={2048}
          required
          placeholder="https://www.tiktok.com/... hoặc https://youtube.com/..."
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Họ và tên
          <input
            className={fieldClass}
            name="reporterName"
            maxLength={120}
            required
            autoComplete="name"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email liên hệ
          <input
            className={fieldClass}
            name="reporterEmail"
            type="email"
            maxLength={254}
            required
            autoComplete="email"
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-ink">
        Tư cách của người báo cáo
        <select
          className={fieldClass}
          name="rightsBasis"
          required
          defaultValue=""
        >
          <option value="" disabled>
            Chọn căn cứ quyền
          </option>
          <option value="rights-owner">Chủ sở hữu quyền</option>
          <option value="authorized-agent">Đại diện được ủy quyền</option>
          <option value="other-legal-interest">Quyền lợi hợp pháp khác</option>
        </select>
      </label>

      <label className="block text-sm font-semibold text-ink">
        Mô tả và căn cứ yêu cầu
        <textarea
          className={`${fieldClass} min-h-36 resize-y`}
          name="details"
          minLength={20}
          maxLength={4000}
          required
          placeholder="Mô tả tác phẩm, quyền sở hữu hoặc ủy quyền và lý do nội dung vi phạm..."
        />
      </label>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink-secondary">
        <input
          type="checkbox"
          name="declaration"
          required
          className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span>
          Tôi cam kết thông tin trong báo cáo là chính xác, được gửi với thiện
          chí và tôi có quyền yêu cầu xử lý nội dung nêu trên.
        </span>
      </label>

      {message && (
        <div
          role="status"
          className={`rounded-compact border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-accent/30 bg-accent-muted text-accent'
              : 'border-danger/30 bg-secondary-muted text-[#ff9da9]'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-bold text-[#00201e] transition-[filter,transform,opacity] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <SpinnerIcon size={16} className="animate-spin" />
        ) : (
          <CheckIcon size={16} />
        )}
        {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
      </button>
    </form>
  );
}
