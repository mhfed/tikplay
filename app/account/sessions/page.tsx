import { SessionList } from '@/components/account/SessionsPrivacy';

export default function SessionsPage() {
  return (
    <>
      <div className="account-section-heading">
        <p className="account-kicker">Thiết bị & phiên</p>
        <h2>Nơi bạn đang đăng nhập</h2>
        <p>
          Thu hồi một phiên bất kỳ. Việc này không dừng bài hát đang phát trên
          thiết bị hiện tại.
        </p>
      </div>
      <SessionList />
    </>
  );
}
