interface SlideWrapperProps {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}

export default function SlideWrapper({
  children,
  className = '',
  dark,
}: SlideWrapperProps) {
  return (
    <section
      className={`flex min-h-[calc(100vh-6rem)] w-full shrink-0 flex-col rounded-xl border border-slate-200 p-10 ${dark ? 'bg-slate-900' : 'bg-white'} ${className}`.trim()}
    >
      {children}
    </section>
  );
}
