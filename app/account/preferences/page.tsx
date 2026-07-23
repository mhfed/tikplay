import { PreferencesForm } from '@/components/account/AccountForms';

export default function PreferencesPage() {
  return (
    <>
      <div className="account-section-heading">
        <p className="account-kicker">Sở thích nghe</p>
        <h2>Để TikPlay hiểu gu của bạn.</h2>
        <p>
          Các lựa chọn này điều chỉnh gợi ý, không ảnh hưởng đến thư viện hay
          trình phát.
        </p>
      </div>
      <PreferencesForm />
    </>
  );
}
