import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      navigate("/login");
    }, 3000); // Redirect after 3 seconds
  }, [navigate]);

  return (
    <div className="splash-container">
      <img src="/wastewise-logo.png" alt="Waste Wise Logo" className="splash-logo" />
    </div>
  );
};

export default SplashScreen;
