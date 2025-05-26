import "./globals.css";

export const metadata = {
  title: "Distribution platform",
  description: "Distribution platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
