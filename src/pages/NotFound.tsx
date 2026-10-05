import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { I } from "../components/icons";

export function NotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      <I.search className="w-12 h-12 mx-auto text-ink-3" aria-hidden />
      <h1 className="t-large text-ink mt-5">Page not found</h1>
      <p className="t-body text-ink-2 mt-2">
        There's nothing at <span className="font-medium text-ink break-all">{pathname}</span>. It may have moved, or the link is incomplete.
      </p>
      <div className="flex justify-center gap-2 mt-8">
        <Button onClick={() => navigate("/")}>Go to Today</Button>
        <Button variant="gray" onClick={() => navigate("/library")}>
          Open Library
        </Button>
      </div>
    </div>
  );
}
