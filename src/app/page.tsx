import { redirect } from "next/navigation";

export default function Home() {
  // 첫 화면 접속 시 즉시 로그인 페이지로 라우팅
  redirect("/login");
}
