export default function Spinner({ fullScreen = false }) {
  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-screen items-center justify-center'
          : 'flex justify-center py-10'
      }
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sena-green border-t-transparent" />
    </div>
  );
}
