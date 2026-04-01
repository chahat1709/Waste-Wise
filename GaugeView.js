import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import GaugeChart from "react-gauge-chart";

const socket = io("http://localhost:5000"); // Adjust for your backend server

const GaugeView = () => {
  const { binId } = useParams();
  const [data, setData] = useState({ fullness: 0, weight: 0, temp: 0, humidity: 0 });

  useEffect(() => {
    socket.emit("subscribeBin", binId); // Request live data

    socket.on("binData", (newData) => {
      if (newData.id === binId) {
        setData(newData);
      }
    });

    return () => {
      socket.off("binData");
    };
  }, [binId]);

  return (
    <div className="gauge-container">
      <h2>Bin {binId} Live Readings</h2>
      <div className="gauges">
        <div className="gauge">
          <h3>Fullness</h3>
          <GaugeChart id="fullness-gauge" percent={data.fullness / 100} />
        </div>
        <div className="gauge">
          <h3>Weight</h3>
          <GaugeChart id="weight-gauge" percent={data.weight / 100} />
        </div>
        <div className="gauge">
          <h3>Temperature</h3>
          <GaugeChart id="temp-gauge" percent={data.temp / 100} />
        </div>
        <div className="gauge">
          <h3>Humidity</h3>
          <GaugeChart id="humidity-gauge" percent={data.humidity / 100} />
        </div>
      </div>
    </div>
  );
};

export default GaugeView;
