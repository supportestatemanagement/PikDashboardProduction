import React from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAreaTrafficStage } from '../services/trafficService';
import pik2Boundary from '../config/pik2Boundary.json';

const geojsonData = {
  type: "FeatureCollection",
  features: [
    pik2Boundary,
    {
      type: "Feature",
      properties: { name: "BGM" },
      geometry: {
        type: "Polygon",
        coordinates: [[
           [106.73749812062556,-6.100383700183727],
            [106.7372822582546,-6.100608044352896],
            [106.7371452300763,-6.100969567095376],
            [106.73706806982801,-6.101372591690662],
            [106.73706806982801,-6.10227329543855],
            [106.73718129928966,-6.103286585345387],
            [106.73729452875358,-6.10437493162938],
            [106.73729452875358,-6.105238101248332],
            [106.73695484036409,-6.106026211424819],
            [106.73472799426179,-6.1089159388142065],
            [106.7328785796999,-6.111167663630283],
            [106.73265212077439,-6.111618007456244],
            [106.73284083654676,-6.112068350904309],
            [106.7334069838617,-6.112781393921125],
            [106.73397313117448,-6.113456907480554],
            [106.73430503508149,-6.113871878888503],
            [106.73313421953398,-6.114010921807186],
            [106.73288237225304,-6.114119927188903],
            [106.73299973015091,-6.114302353574056],
            [106.73326556862301,-6.114630222952864],
            [106.73366464036336,-6.1151071267309725],
            [106.73391319662227,-6.115406837772538],
            [106.73418736217579,-6.1155070150297695],
            [106.734544554654,-6.11549803634929],
            [106.73474813213042,-6.115485273933187],
            [106.7348963419443,-6.115448022709771],
            [106.73507265524648,-6.115429702244704],
            [106.73529484584779,-6.115324062701237],
            [106.73540313303253,-6.115414903923574],
            [106.73544804649794,-6.115487857358279],
            [106.7353964425105,-6.11573580739198],
            [106.7353610591905,-6.116017932770347],
            [106.73533285291253,-6.116274900115734],
            [106.7353776575656,-6.116582125773107],
            [106.73563124344687,-6.117162687948706],
            [106.73604769986468,-6.117748834436782],
            [106.73663037247513,-6.1182994011332426],
            [106.73744532896592,-6.1187677825113695],
            [106.73808467732346,-6.1190759496136025],
            [106.73872402568225,-6.1193115217966465],
            [106.73952271149977,-6.119663022852741],
            [106.7402933161872,-6.120058301239396],
            [106.74220113881142,-6.120849972334241],
            [106.74334871169361,-6.121357711511777],
            [106.74409659180611,-6.121702364819271],
            [106.74488940172324,-6.1219465025346125],
            [106.74548993670128,-6.12207372440432],
            [106.74609047167931,-6.1221562727092405],
            [106.74716806570193,-6.122224860522035],
            [106.74820110450486,-6.122237333340749],
            [106.74974180195636,-6.122310957532335],
            [106.75106246951705,-6.122382826224886],
            [106.75238313707763,-6.122442906737334],
            [106.75224695124479,-6.121652118398188],
            [106.75220307469965,-6.121037612243356],
            [106.75205210208259,-6.118748400848233],
            [106.75175015684857,-6.115520971406212],
            [106.7515614410762,-6.11349443598661],
            [106.7514482116145,-6.112556222544072],
            [106.75107078006971,-6.109403813328825],
            [106.7506933485272,-6.1061763275172325],
            [106.75072602759445,-6.104194896679729],
            [106.75046011810966,-6.104148660856957],
            [106.7501272012122,-6.104112227556598],
            [106.74835327296103,-6.103924581711453],
            [106.74684354678851,-6.103399172994372],
            [106.74563576585223,-6.103211526899514],
            [106.74223888196462,-6.10227329543855],
            [106.74057818317726,-6.101935531710922],
            [106.73897902625535,-6.101154716654797],
            [106.73822871916555,-6.100725115296189],
            [106.73786341989444,-6.100471120737639],
            [106.73766598884819,-6.100402914277233],
            [106.73749812062556,-6.100383700183727]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "GI" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [
              106.74184361605671,
              -6.087471288063611
            ],
            [
              106.74104329729391,
              -6.088744575981053
            ],
            [
              106.74020296259181,
              -6.090574922074893
            ],
            [
              106.73972277133407,
              -6.091887992602821
            ],
            [
              106.73912253226086,
              -6.0934397990858
            ],
            [
              106.73864234100313,
              -6.094394754692004
            ],
            [
              106.73816214974539,
              -6.095190549731285
            ],
            [
              106.73780200630102,
              -6.095906764258743
            ],
            [
              106.73772197442474,
              -6.096384240078393
            ],
            [
              106.73792205411661,
              -6.096941294665285
            ],
            [
              106.73832221349801,
              -6.097657506855313
            ],
            [
              106.73940264382901,
              -6.098373718087728
            ],
            [
              106.74100328135461,
              -6.099169507225298
            ],
            [
              106.74244385513003,
              -6.09956740135064
            ],
            [
              106.74292404638771,
              -6.0996071907468945
            ],
            [
              106.74432460422378,
              -6.099288875493897
            ],
            [
              106.74568514612292,
              -6.09865224441981
            ],
            [
              106.7469656561434,
              -6.098214560118777
            ],
            [
              106.7478059908455,
              -6.098174770619082
            ],
            [
              106.74868634148697,
              -6.098134981116559
            ],
            [
              106.74992683557048,
              -6.09793603355935
            ],
            [
              106.75048705870444,
              -6.098294139109186
            ],
            [
              106.75077111637455,
              -6.098376210293317
            ],
            [
              106.75124736153026,
              -6.09830540155717
            ],
            [
              106.75158197246216,
              -6.0980372146936475
            ],
            [
              106.75176283340477,
              -6.097654367827559
            ],
            [
              106.75168753684869,
              -6.09690150507123
            ],
            [
              106.75168753684869,
              -6.09634445044297
            ],
            [
              106.75272795124266,
              -6.093161270047631
            ],
            [
              106.7546087003364,
              -6.087312126861832
            ],
            [
              106.75728976819539,
              -6.0796723337426215
            ],
            [
              106.75796909340659,
              -6.0775396095245355
            ],
            [
              106.75770808665031,
              -6.0769288128415315
            ],
            [
              106.75724227151065,
              -6.076399479140324
            ],
            [
              106.75649496877709,
              -6.0759110530659015
            ],
            [
              106.75487747828177,
              -6.075097127585678
            ],
            [
              106.75266604347654,
              -6.074059174424981
            ],
            [
              106.75160116381994,
              -6.07397279497196
            ],
            [
              106.75104824315288,
              -6.074459117316844
            ],
            [
              106.75065916919155,
              -6.075149098066401
            ],
            [
              106.75012691526007,
              -6.0767278011700085
            ],
            [
              106.74908839234374,
              -6.07883766122675
            ],
            [
              106.74788602272179,
              -6.080866058573008
            ],
            [
              106.74596525768868,
              -6.083213709676599
            ],
            [
              106.74432460422378,
              -6.0847257507235355
            ],
            [
              106.74303778043998,
              -6.085857424398981
            ],
            [
              106.74228379137742,
              -6.0865959008693835
            ],
            [
              106.74184361605671,
              -6.087471288063611
            ]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "RWI" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [
              106.73530597306643,
              -6.08048125824422
            ],
            [
              106.73369453690157,
              -6.081913678329471
            ],
            [
              106.73030075467926,
              -6.0847785070507285
            ],
            [
              106.72942178949859,
              -6.08553112901285
            ],
            [
              106.72893347551008,
              -6.086040969096828
            ],
            [
              106.72856724001798,
              -6.087109203897583
            ],
            [
              106.72856724001798,
              -6.087570486450588
            ],
            [
              106.72876256561335,
              -6.088687274148697
            ],
            [
              106.72895789120878,
              -6.088905775817068
            ],
            [
              106.72925087960186,
              -6.089027165595525
            ],
            [
              106.732571414728,
              -6.092256123614632
            ],
            [
              106.73542805156285,
              -6.095072341819531
            ],
            [
              106.73608727544809,
              -6.095436506886529
            ],
            [
              106.7365755894366,
              -6.095387951558465
            ],
            [
              106.73733247611943,
              -6.0950237864584835
            ],
            [
              106.7380161157048,
              -6.093931289671531
            ],
            [
              106.73916365357854,
              -6.091333566161566
            ],
            [
              106.74006703445798,
              -6.088565884293445
            ],
            [
              106.74077508974204,
              -6.0876918765307835
            ],
            [
              106.74111690953544,
              -6.0871577599743745
            ],
            [
              106.74145872932735,
              -6.086769311237262
            ],
            [
              106.741605223524,
              -6.0862594718428795
            ],
            [
              106.74121457233309,
              -6.085725353864049
            ],
            [
              106.74097041533742,
              -6.085312625970644
            ],
            [
              106.7402623600534,
              -6.084462891075148
            ],
            [
              106.7396275518683,
              -6.0840501622122645
            ],
            [
              106.73921248497737,
              -6.0836859894229605
            ],
            [
              106.73835793549682,
              -6.082763417254455
            ],
            [
              106.73784520580818,
              -6.082520634841643
            ],
            [
              106.73764988021276,
              -6.082156461016268
            ],
            [
              106.73703948772635,
              -6.082107904487685
            ],
            [
              106.73655117373784,
              -6.08174373038284
            ],
            [
              106.73613610684691,
              -6.081209607917216
            ],
            [
              106.73559896145957,
              -6.080456979905563
            ],
            [
              106.73530597306643,
              -6.08048125824422
            ]
        ]]
      }
    }
  ]
};

const AREA_CONFIG = {
  PIK2: { center: [-6.051, 106.694] },
  BGM: { center: [-6.1100, 106.7427] },
  GI:  { center: [-6.0870558085485555, 106.74827513773329] },
  RWI: { center: [-6.086914979546606, 106.73540363586415, ] }
};

const areaBounds = L.geoJSON(geojsonData).getBounds();

function MapSizeController({ isActive }) {
  const map = useMap();
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (!isActive) return undefined;
    const refreshSize = () => {
      map.invalidateSize({ animate: false, pan: false });
      if (!initialized.current && map.getSize().x > 0 && map.getSize().y > 0) {
        const overlay = map.getContainer().parentElement.parentElement.querySelector('.traffic-overlay');
        const panelWidth = overlay ? overlay.getBoundingClientRect().width + 24 : 24;
        map.fitBounds(areaBounds, {
          paddingTopLeft: [24, 24],
          paddingBottomRight: [map.getSize().x > 700 ? panelWidth : 24, 24],
          animate: false,
        });
        initialized.current = true;
      }
    };
    const frame = window.requestAnimationFrame(refreshSize);
    const shortTimer = window.setTimeout(refreshSize, 120);
    const layoutTimer = window.setTimeout(refreshSize, 360);
    window.addEventListener('resize', refreshSize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(layoutTimer);
      window.removeEventListener('resize', refreshSize);
    };
  }, [isActive, map]);

  return null;
}

// TEMPLATE LABEL
const createLabel = (name, count, zoom) => {
  const titleSize = Math.max(10, Math.min(22, 14 + (zoom - 12) * 4));
  const countSize = Math.max(9, Math.min(16, titleSize - 3));
  return L.divIcon({
    className: 'custom-label',
    html: `
      <div style="
        color: white;
        text-align: center;
        line-height: 1.1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-shadow: 0 1px 3px #000, 0 0 4px #000;
      ">
        <div style="font-size: ${titleSize}px; font-weight: 800;">${name}</div>
        <div style="font-size: ${countSize}px; font-weight: 600;">
          ${(count || 0).toLocaleString('id-ID')}
        </div>
      </div>
    `,
    iconSize: [80, 40],
    iconAnchor: [40, 20],
  });
};

function AreaMarker({ area, count, children }) {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const [zoom, setZoom] = React.useState(() => map.getZoom());
  return (
    <Marker position={AREA_CONFIG[area].center} icon={createLabel(area, count, zoom)}>
      {children}
    </Marker>
  );
}

export default function HeatmapMap({ traffic, isActive = true }) {
  // Ambil data kendaraan dari props, berikan default jika kosong
  const data = {
    BGM: traffic?.vehicles?.bgm ?? 0,
    GI: traffic?.vehicles?.gi ?? 0,
    RWI: traffic?.vehicles?.rwi ?? 0,
    PIK2: traffic?.vehicles?.pik2 ?? 0,
  };
  const areaStages = Object.fromEntries(
    Object.entries(data).map(([area, value]) => [area, getAreaTrafficStage(area, value)])
  );

  // Fungsi style dinamis untuk setiap poligon di GeoJSON
  const styleGeoJson = (feature) => {
    const areaName = feature.properties.name;
    const value = data[areaName] || 0;

    return {
      color: (areaStages[areaName] || getAreaTrafficStage(areaName, value)).color,
      weight: 2.5,
      opacity: 1,
      fillColor: (areaStages[areaName] || getAreaTrafficStage(areaName, value)).color,
      fillOpacity: 0.3,
    };
  };

  return (
    <div className="traffic-map-layer">
      <MapContainer
        bounds={areaBounds}
        boundsOptions={{ padding: [30, 30] }}
        zoomSnap={0.25}
        zoomDelta={0.5}
        style={{ height: '100%', width: '100%' }}
      >
        <MapSizeController isActive={isActive} />
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <GeoJSON
          key={Object.values(areaStages).map((stage) => stage.stage).join('-')}
          data={geojsonData}
          style={styleGeoJson}
        />

        {/* Render semua label berdasarkan AREA_CONFIG */}
        {Object.keys(AREA_CONFIG).map((area) => (
          <AreaMarker
            key={area}
            area={area}
            count={data[area]}
          >
            <Popup className="traffic-popup">
              <div className="popup-title">{area}</div>
              <div className="popup-row"><span>Vehicle In</span><strong>{data[area].toLocaleString('id-ID')}</strong></div>
              {area === 'BGM' && <div className="popup-row"><span>CP BGM</span><strong>{(traffic?.checkpoints?.bgm || 0).toLocaleString('id-ID')}</strong></div>}
              <div className="popup-row"><span>Status</span><strong style={{ color: areaStages[area].color }}>STAGE {areaStages[area].stage} · {areaStages[area].label}</strong></div>
            </Popup>
          </AreaMarker>
        ))}
      </MapContainer>
    </div>
  );
}
