import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";

// basename 必须和 vite.config.ts 的 base 一致 (GitHub Pages 子路径 /CodingPlan/)
// 本地 dev 时 basename = '/CodingPlan/' 也能工作(Vite 会用相同 base 启动)
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <Router basename={BASENAME}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}