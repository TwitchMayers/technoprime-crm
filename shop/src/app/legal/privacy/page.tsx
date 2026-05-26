import { GlassCard, SectionTitle } from '@technoprime/ui';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Политика обработки персональных данных | TechnoPrime',
  description:
    'Документ о персональных данных TechnoPrime: какие данные собираются, зачем используются и как защищаются.',
  path: '/legal/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Юридическая информация"
        title="Политика обработки персональных данных"
        subtitle="Документ описывает, какие данные мы собираем и как используем их для работы аккаунта TechnoPrime ID."
      />

      <GlassCard className="space-y-4 p-6 text-sm text-slate-200">
        <p>
          Актуальная редакция: <strong>22 февраля 2026</strong> (версия <strong>2026-02</strong>).
        </p>
        <p>
          Для входа и обслуживания заказов мы обрабатываем: номер телефона, Telegram ID/username (при привязке),
          историю заказов, параметры профиля и адрес доставки.
        </p>
        <p>
          Цели обработки: авторизация в личном кабинете, защита от мошенничества, отображение заказов и подписок,
          отправка сервисных уведомлений по выбранным каналам.
        </p>
        <p>
          Мы не передаем ваши данные третьим лицам для рекламных рассылок без отдельного согласия. Доступ к данным
          ограничен сотрудниками по ролям и журналируется.
        </p>
        <p>
          Вы можете отвязать Telegram в личном кабинете. При этом аккаунт по номеру телефона сохраняется и доступ по SMS
          остается доступным.
        </p>
      </GlassCard>
    </div>
  );
}
