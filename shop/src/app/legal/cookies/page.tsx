import { GlassCard, SectionTitle } from '@technoprime/ui';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Политика cookies | TechnoPrime',
  description:
    'Политика использования cookies на сайте TechnoPrime: авторизация, безопасность, аналитические cookies и управление согласием.',
  path: '/legal/cookies',
});

export default function CookiesPolicyPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Юридическая информация"
        title="Политика использования cookies"
        subtitle="Мы используем cookies для входа в аккаунт, безопасности сессии и улучшения сервиса."
      />

      <GlassCard className="space-y-4 p-6 text-sm text-slate-200">
        <p>
          Необходимые cookies применяются для авторизации, сохранения сессии и защиты от несанкционированного доступа.
        </p>
        <p>
          Аналитические cookies включаются только после вашего согласия через баннер в личном кабинете.
        </p>
        <p>
          Вы можете изменить выбор в любой момент: повторно открыть личный кабинет и выбрать режим cookies.
        </p>
        <p>
          Продолжая пользоваться аккаунтом после выбора режима cookies, вы подтверждаете использование выбранной категории.
        </p>
      </GlassCard>
    </div>
  );
}
