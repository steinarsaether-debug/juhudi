export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];
  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${sz} animate-spin rounded-full border-2 border-primary-200 border-t-primary-700`} />
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
