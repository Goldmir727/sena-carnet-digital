export default function Spinner({ fullScreen = false, size = 'md' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-10 w-10 border-4',
  };

  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-screen items-center justify-center'
          : 'flex justify-center py-10'
      }
    >
      <div
        className={`${sizes[size]} animate-spin rounded-full border-sena-green border-t-transparent`}
      />
    </div>
  );
}
