import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">??</div>
        <h1 className="text-xl font-extrabold mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-text-secondary mb-6">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link href="/" className="btn-primary h-10 px-4 text-sm inline-flex items-center">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
