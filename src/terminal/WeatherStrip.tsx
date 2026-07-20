import { Box, Group, Text } from "@mantine/core";
import {
  IconCloud, IconCloudFog, IconCloudRain, IconCloudSnow, IconCloudStorm,
  IconMoon, IconSun, IconWind,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { terminalApi, type WeatherHour } from "./terminalApi";
import type { TimeFormat } from "./timeFormat";

// TERM-WEATHER-ICONS: map a WeatherFlow icon code to a Tabler weather icon.
function WeatherIcon({ code, size = 22 }: { code: string | null; size?: number }) {
  const c = code ?? "";
  const Icon =
    c.includes("thunder") ? IconCloudStorm
    : c.includes("snow") || c.includes("sleet") ? IconCloudSnow
    : c.includes("rain") ? IconCloudRain
    : c.includes("fog") ? IconCloudFog
    : c.includes("wind") ? IconWind
    : c.includes("cloud") ? IconCloud
    : c.includes("night") ? IconMoon
    : c.includes("clear") || c.includes("day") ? IconSun
    : IconCloud;
  return <Icon size={size} stroke={1.5} />;
}

/** Slim bottom strip: current conditions + a wind arrow + the next few hours.
 *  Subordinate to the roster; hidden entirely when weather isn't configured. */
export function WeatherStrip({ timeFormat }: { timeFormat: TimeFormat }) {
  const q = useQuery({
    queryKey: ["terminal-weather"],
    queryFn: () => terminalApi.weather(),
    refetchInterval: 5 * 60 * 1000, // 5 min; the server caches so this is cheap
    retry: false,
  });
  const w = q.data;
  if (!w) return null;

  const temp = (t: number | null | undefined) => (t == null ? "—" : `${Math.round(t)}°`);
  const hourLabel = (h: WeatherHour) => {
    if (!h.time) return "";
    const d = new Date(h.time * 1000);
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      hour12: timeFormat === "12h",
    }).format(d);
  };

  return (
    <Box
      px="xl"
      py="sm"
      style={{
        borderTop: "1px solid var(--mantine-color-default-border)",
        background: "var(--mantine-color-default)",
      }}
    >
      <Group justify="space-between" wrap="wrap" gap="xl">
        <Group gap="lg" wrap="nowrap">
          <WeatherIcon code={w.icon} size={40} />
          <div>
            <Text fw={300} fz={30} lh={1} style={{ fontVariantNumeric: "tabular-nums" }}>{temp(w.air_temperature)}</Text>
            {w.feels_like != null && (
              <Text size="xs" c="dimmed">Feels {temp(w.feels_like)}</Text>
            )}
          </div>
          {w.conditions && <Text fz={18}>{w.conditions}</Text>}
          <Group gap={6} wrap="nowrap" title={`${w.wind_direction_cardinal ?? ""} ${Math.round(w.wind_avg ?? 0)} km/h`}>
            <WindArrow degrees={w.wind_direction} />
            <Text fz={18}>
              {Math.round(w.wind_avg ?? 0)}
              {w.wind_gust != null ? `–${Math.round(w.wind_gust)}` : ""} km/h
            </Text>
          </Group>
        </Group>

        <Group gap="lg" wrap="nowrap">
          {w.hourly.map((h, i) => (
            <div key={i} style={{ textAlign: "center", minWidth: 52 }}>
              <Text size="xs" c="dimmed">{hourLabel(h)}</Text>
              <Group justify="center" gap={0}><WeatherIcon code={h.icon} size={18} /></Group>
              <Text fw={400}>{temp(h.air_temperature)}</Text>
              {h.precip_probability != null && h.precip_probability > 0 && (
                <Text size="xs" c="blue">{h.precip_probability}%</Text>
              )}
            </div>
          ))}
        </Group>
      </Group>
    </Box>
  );
}

/** Points in the direction the wind is blowing FROM (met convention), rotated by
 *  the reported bearing in degrees. */
function WindArrow({ degrees }: { degrees: number | null }) {
  const deg = degrees ?? 0;
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${deg}deg)`, transition: "transform 0.4s" }}
      aria-label={`Wind from ${deg}°`}
    >
      {/* An upward arrow at 0°; met wind_direction is where it comes from. */}
      <path d="M12 3 L18 20 L12 16 L6 20 Z" fill="var(--mantine-color-blue-6)" />
    </svg>
  );
}
