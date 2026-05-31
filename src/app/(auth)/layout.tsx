export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0F0F23]">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
