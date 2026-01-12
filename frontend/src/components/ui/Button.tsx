'use client';
import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export default function Button(
  { className, variant='primary', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'ghost'|'danger' }
) {
  const styles = {
    primary: 'btn btn-primary',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
  } as const;
  return <button className={clsx(styles[variant], className)} {...rest} />;
}