'use client';

type BackButtonProps = {
  label?: string;
  className?: string;
};

export function BackButton({
  label = 'Назад',
  className,
}: BackButtonProps) {
  const handleBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </button>
  );
}
