import { ProfileForm } from '@/components/account/AccountForms';

export default function ProfilePage() {
  return (
    <>
      <div className="account-section-heading">
        <p className="account-kicker">Hồ sơ</p>
        <h2>Thông tin của bạn</h2>
        <p>
          Chỉ những thông tin cần thiết để TikPlay nhận ra không gian cá nhân
          của bạn.
        </p>
      </div>
      <ProfileForm />
    </>
  );
}
