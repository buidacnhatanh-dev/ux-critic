import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        This page does not exist. <Link href="/">Go to Projects</Link>
      </p>
    </>
  );
}
