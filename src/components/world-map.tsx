"use client";
import { useEffect, useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { feature } from "topojson-client";

// ISO numeric -> ISO alpha-2 (small lookup for common countries)
const NUM_TO_ALPHA2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","020":"AD","024":"AO","028":"AG","031":"AZ","032":"AR","036":"AU","040":"AT",
  "044":"BS","048":"BH","050":"BD","051":"AM","052":"BB","056":"BE","060":"BM","064":"BT","068":"BO","070":"BA",
  "072":"BW","076":"BR","084":"BZ","090":"SB","096":"BN","100":"BG","104":"MM","108":"BI","112":"BY","116":"KH",
  "120":"CM","124":"CA","132":"CV","140":"CF","144":"LK","148":"TD","152":"CL","156":"CN","158":"TW","170":"CO",
  "174":"KM","178":"CG","180":"CD","188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ","204":"BJ","208":"DK",
  "212":"DM","214":"DO","218":"EC","222":"SV","226":"GQ","231":"ET","232":"ER","233":"EE","242":"FJ","246":"FI",
  "250":"FR","262":"DJ","266":"GA","268":"GE","270":"GM","275":"PS","276":"DE","288":"GH","296":"KI","300":"GR",
  "320":"GT","324":"GN","328":"GY","332":"HT","340":"HN","344":"HK","348":"HU","352":"IS","356":"IN","360":"ID",
  "364":"IR","368":"IQ","372":"IE","376":"IL","380":"IT","384":"CI","388":"JM","392":"JP","398":"KZ","400":"JO",
  "404":"KE","408":"KP","410":"KR","414":"KW","417":"KG","418":"LA","422":"LB","426":"LS","428":"LV","430":"LR",
  "434":"LY","438":"LI","440":"LT","442":"LU","450":"MG","454":"MW","458":"MY","462":"MV","466":"ML","470":"MT",
  "478":"MR","480":"MU","484":"MX","496":"MN","498":"MD","499":"ME","504":"MA","508":"MZ","512":"OM","516":"NA",
  "520":"NR","524":"NP","528":"NL","540":"NC","548":"VU","554":"NZ","558":"NI","562":"NE","566":"NG","578":"NO",
  "586":"PK","591":"PA","598":"PG","600":"PY","604":"PE","608":"PH","616":"PL","620":"PT","624":"GW","626":"TL",
  "630":"PR","634":"QA","642":"RO","643":"RU","646":"RW","682":"SA","686":"SN","688":"RS","690":"SC","694":"SL",
  "702":"SG","703":"SK","704":"VN","705":"SI","706":"SO","710":"ZA","716":"ZW","724":"ES","728":"SS","729":"SD",
  "740":"SR","748":"SZ","752":"SE","756":"CH","760":"SY","762":"TJ","764":"TH","768":"TG","776":"TO","780":"TT",
  "784":"AE","788":"TN","792":"TR","795":"TM","798":"TV","800":"UG","804":"UA","807":"MK","818":"EG","826":"GB",
  "834":"TZ","840":"US","854":"BF","858":"UY","860":"UZ","862":"VE","882":"WS","887":"YE","894":"ZM",
};

interface Props {
  intensity: Record<string, number>;
  onHover?: (cc: string | null) => void;
}

export function WorldMap({ intensity, onHover }: Props) {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const fc: any = feature(topo, topo.objects.countries);
        setGeoData(fc);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fillFor = useMemo(() => {
    return (numericId: string) => {
      const cc = NUM_TO_ALPHA2[numericId];
      if (!cc) return "hsl(240 6% 11%)";
      const v = intensity[cc] ?? 0;
      if (v === 0) return "hsl(240 6% 13%)";
      // gradient: dim teal -> bright primary
      const alpha = 0.18 + v * 0.82;
      return `hsla(158, 95%, 48%, ${alpha})`;
    };
  }, [intensity]);

  if (!geoData) {
    return (
      <div className="absolute inset-0 grid place-items-center text-xs font-mono text-muted-foreground">
        Loading map…
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 165 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} maxZoom={6} minZoom={0.8}>
          <Geographies geography={geoData}>
            {({ geographies }) =>
              geographies.map((geo: any) => {
                const id = String(geo.id ?? "").padStart(3, "0");
                const cc = NUM_TO_ALPHA2[id];
                const fill = fillFor(id);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => cc && onHover?.(cc)}
                    onMouseLeave={() => onHover?.(null)}
                    style={{
                      default: {
                        fill,
                        stroke: "hsl(240 6% 18%)",
                        strokeWidth: 0.4,
                        outline: "none",
                      },
                      hover: {
                        fill: "hsl(158 95% 60%)",
                        stroke: "hsl(158 95% 70%)",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: cc ? "pointer" : "default",
                      },
                      pressed: { fill, outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
