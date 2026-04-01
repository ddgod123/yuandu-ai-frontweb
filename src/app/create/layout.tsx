export default function CreateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <style>{`
        body { overflow: hidden; }
        footer { display: none !important; }
      `}</style>
      {children}
    </>
  );
}

