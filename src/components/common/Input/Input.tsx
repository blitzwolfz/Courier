import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export function Input({ mono, className, ...props }: InputProps) {
  const classNames = [styles.input, mono ? styles.mono : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return <input className={classNames} {...props} />;
}
