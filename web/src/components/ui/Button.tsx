import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-amber-600 text-white hover:bg-amber-700',
  secondary: 'border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  );
});
