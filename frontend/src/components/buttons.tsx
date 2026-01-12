export function PrimaryButton({ children, ...props }: any) {
  return (
    <button
      className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-teal-600 rounded-lg font-medium text-white hover:opacity-90 transition disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...props }: any) {
  return (
    <button
      className="px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg font-medium text-white hover:bg-slate-700/50 transition disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}