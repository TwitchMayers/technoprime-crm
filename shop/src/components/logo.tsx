import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3.5">
      <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center sm:h-[50px] sm:w-[50px] md:h-[56px] md:w-[56px]">
        <Image
          src="/brand/logo-mark.png"
          alt="TechnoPrime"
          fill
          unoptimized
          sizes="(min-width: 768px) 56px, (min-width: 640px) 50px, 40px"
          className="object-contain"
          priority
        />
      </span>
      <span className="font-display whitespace-nowrap text-[1.2rem] leading-none tracking-[0.01em] text-white sm:text-[1.48rem] md:text-[1.72rem] xl:text-[1.9rem]">
        Techno<span className="text-cyan-200">Prime</span>
      </span>
    </div>
  );
}
