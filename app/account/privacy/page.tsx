import { PrivacyControls } from '@/components/account/SessionsPrivacy';

export default function PrivacyPage() {
  return (
    <>
      <div className="account-section-heading">
        <p className="account-kicker">Quyền riêng tư & dữ liệu</p>
        <h2>Dữ liệu vẫn thuộc về bạn.</h2>
        <p>
          Xuất một bản sao, xóa lịch sử hoặc bắt đầu quy trình xóa tài khoản có
          thời gian chờ rõ ràng.
        </p>
      </div>
      <PrivacyControls />
    </>
  );
}
