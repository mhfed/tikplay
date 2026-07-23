'use client';

import Link from 'next/link';
import { useAuthFlow } from '@/components/auth/AuthFlowProvider';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';

export default function PersonalizedHome() {
  const { state } = useAuthSession();
  const { openAuth } = useAuthFlow();
  const personalized = state === 'authenticated';
  return (
    <section className="personal-home" aria-labelledby="personal-home-title">
      <div className="personal-home__intro">
        <p className="account-kicker">
          {personalized ? 'Không gian của bạn' : 'Khám phá không giới hạn'}
        </p>
        <h2 id="personal-home-title">
          {personalized
            ? 'Nghe tiếp theo nhịp của bạn.'
            : 'Một bài hát hay đang chờ.'}
        </h2>
        <p>
          {personalized
            ? 'Gợi ý được xây từ lựa chọn của bạn, với lý do rõ ràng và quyền tắt bất cứ lúc nào.'
            : 'Bắt đầu bằng một liên kết TikTok hoặc YouTube. Không cần đăng nhập để nghe.'}
        </p>
      </div>
      <div className="personal-home__grid">
        <article className="personal-module personal-module--feature">
          <span className="personal-module__orb" aria-hidden="true" />
          <div>
            <p className="account-kicker">
              {personalized ? 'Tiếp tục nghe' : 'Bắt đầu nhẹ nhàng'}
            </p>
            <h3>
              {personalized
                ? 'Danh sách đang chờ bạn quay lại'
                : 'Tạo thư viện đầu tiên'}
            </h3>
            <p>
              {personalized
                ? 'Bạn chưa có đủ lịch sử để cá nhân hóa. TikPlay sẽ dùng tuyển chọn biên tập trong lúc chờ.'
                : 'Dán link để xử lý âm thanh và lưu những bài bạn muốn giữ.'}
            </p>
            <Link href="/" className="account-primary">
              Mở trình phát
            </Link>
          </div>
        </article>
        <article className="personal-module">
          <p className="account-kicker">
            {personalized ? 'Theo tâm trạng' : 'Tuyển chọn hôm nay'}
          </p>
          <h3>{personalized ? 'Chọn một mood' : 'Neon after hours'}</h3>
          <div className="personal-tags">
            <span>Thư giãn</span>
            <span>Tập trung</span>
            <span>Năng lượng</span>
          </div>
          <p className="personal-note">
            {personalized
              ? 'Dựa trên sở thích đã lưu'
              : 'Gợi ý biên tập · chưa đủ dữ liệu cá nhân'}
          </p>
        </article>
      </div>
      {personalized && (
        <button
          type="button"
          className="personal-optout"
          onClick={() =>
            openAuth({
              source: 'personalization-settings',
              intent: {
                kind: 'navigate',
                label: 'Sở thích nghe',
                returnTo: '/account/preferences',
              },
            })
          }
        >
          Điều chỉnh cá nhân hóa
        </button>
      )}
    </section>
  );
}
