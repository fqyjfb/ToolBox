import React from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text
}) => {
  const sizeClasses = {
    xs: 'dot-xs',
    sm: 'dot-sm',
    md: 'dot-md',
    lg: 'dot-lg'
  };

  return (
    <div className="loader">
      <div className={`dot dot-1 ${sizeClasses[size]}`}></div>
      <div className={`dot dot-2 ${sizeClasses[size]}`}></div>
      <div className={`dot dot-3 ${sizeClasses[size]}`}></div>
      <div className={`dot dot-4 ${sizeClasses[size]}`}></div>
      <div className={`dot dot-5 ${sizeClasses[size]}`}></div>
      {text && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;