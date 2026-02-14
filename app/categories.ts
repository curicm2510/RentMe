"use client";

import type { Lang } from "./i18n";

export type CategoryKey =
  | "construction_tools"
  | "electronics"
  | "film_photo"
  | "garden"
  | "home"
  | "party"
  | "sports_leisure"
  | "vehicle"
  | "other";

export type Subcategory = {
  key: string;
  label: Record<Lang, string>;
};

export type Category = {
  key: CategoryKey;
  label: Record<Lang, string>;
  subcategories: Subcategory[];
};

export const categories: Category[] = [
  {
    key: "construction_tools",
    label: { en: "Construction Equipment & Tools", hr: "Građevinska oprema i alati" },
    subcategories: [
      { key: "compressed_air", label: { en: "Compressed Air", hr: "Kompresirani zrak" } },
      { key: "construction_machinery", label: { en: "Construction Machinery", hr: "Građevinski strojevi" } },
      { key: "drills_screwdrivers", label: { en: "Drills and Screwdrivers", hr: "Bušilice i odvijači" } },
      { key: "electricity_energy", label: { en: "Electricity & Energy", hr: "Elektrika i energija" } },
      { key: "flooring_tiling_carpeting", label: { en: "Flooring, Tiling & Carpeting", hr: "Podovi, pločice i tepisi" } },
      { key: "hand_tools", label: { en: "Hand Tools", hr: "Ručni alati" } },
      { key: "magnetic_detector", label: { en: "Hole in One / Magnetic detector", hr: "Detektor metala / magnetni detektor" } },
      { key: "land_facility_machinery", label: { en: "Land and facility machinery", hr: "Strojevi za zemljane i komunalne radove" } },
      { key: "measuring_instrument", label: { en: "Measuring Instrument", hr: "Mjerni instrumenti" } },
      { key: "milling_planing", label: { en: "Milling & Planing", hr: "Glodanje i blanjanje" } },
      { key: "nailers_staplers", label: { en: "Nailers & Staplers", hr: "Čavljarice i klamerice" } },
      { key: "painting_wallpaper", label: { en: "Painting and Wallpaper", hr: "Bojanje i tapete" } },
      { key: "plumbing_tools", label: { en: "Plumbing tools", hr: "Vodoinstalaterski alati" } },
      { key: "protective_gear", label: { en: "Protective Gear", hr: "Zaštitna oprema" } },
      { key: "sanding_grinding_polishing", label: { en: "Sanding, Grinding & Polishing", hr: "Brušenje, mljevenje i poliranje" } },
      { key: "sawing_cutting", label: { en: "Sawing & Cutting", hr: "Piljenje i rezanje" } },
      { key: "scaffolding", label: { en: "Scaffolding", hr: "Skele" } },
      { key: "tools_package", label: { en: "Tools Package", hr: "Set alata" } },
      { key: "transport_lifting", label: { en: "Transport & Lifting", hr: "Transport i dizanje" } },
      { key: "ventilation", label: { en: "Ventilation", hr: "Ventilacija" } },
      { key: "welder", label: { en: "Welder", hr: "Aparat za varenje" } },
      { key: "work_lights", label: { en: "Work Lights", hr: "Radna rasvjeta" } },
      { key: "other_construction_tools", label: { en: "Other in Construction & Tools", hr: "Ostalo u građevini i alatima" } },
    ],
  },
  {
    key: "electronics",
    label: { en: "Electronics", hr: "Elektronika" },
    subcategories: [
      { key: "card_terminal", label: { en: "Card Terminal", hr: "Kartični terminal" } },
      { key: "computers_accessories", label: { en: "Computers & Accessories", hr: "Računala i oprema" } },
      { key: "drone", label: { en: "Drone", hr: "Dron" } },
      { key: "fm_radio", label: { en: "FM-radio", hr: "FM radio" } },
      { key: "inverter", label: { en: "Inverter", hr: "Inverter" } },
      { key: "mobile_tablet", label: { en: "Mobile & Tablet", hr: "Mobiteli i tableti" } },
      { key: "office_machinery", label: { en: "Office Machinery", hr: "Uredski strojevi" } },
      { key: "projector_tv", label: { en: "Projector & TV", hr: "Projektor i TV" } },
      { key: "satellite_instrument", label: { en: "Satellite instrument", hr: "Satelitska oprema" } },
      { key: "smart_speaker", label: { en: "Smart Speaker", hr: "Pametni zvučnik" } },
      { key: "sound", label: { en: "Sound", hr: "Zvuk" } },
      { key: "two_way_radio", label: { en: "Two-way radio", hr: "Voki-toki" } },
      { key: "video_games", label: { en: "Video games", hr: "Videoigre" } },
      { key: "other_electronics", label: { en: "Other in Electronics", hr: "Ostalo u elektronici" } },
    ],
  },
  {
    key: "film_photo",
    label: { en: "Film & Photography", hr: "Film i fotografija" },
    subcategories: [
      { key: "camera_bag", label: { en: "Camera Bag", hr: "Torba za fotoaparat" } },
      { key: "camera_battery", label: { en: "Camera Battery", hr: "Baterija za fotoaparat" } },
      { key: "camera_package_deals", label: { en: "Camera Package Deals", hr: "Paketi opreme" } },
      { key: "camera_lenses", label: { en: "Camera lenses", hr: "Objektivi" } },
      { key: "cameras", label: { en: "Cameras", hr: "Fotoaparati" } },
      { key: "color_sensor", label: { en: "Color Sensor", hr: "Senzor boje" } },
      { key: "flash_lights", label: { en: "Flash and lights", hr: "Bljeskalice i svjetla" } },
      { key: "follow_focus_support", label: { en: "Follow Focus & Lens Support", hr: "Follow focus i nosaci objektiva" } },
      { key: "memory_card", label: { en: "Memory Card", hr: "Memorijska kartica" } },
      { key: "monitor", label: { en: "Monitor", hr: "Monitor" } },
      { key: "photo_background", label: { en: "Photo Background", hr: "Foto pozadina" } },
      { key: "photo_printer", label: { en: "Photo Printer", hr: "Foto printer" } },
      { key: "stand_rigs", label: { en: "Stand & Rigs", hr: "Stativi i rigovi" } },
      { key: "streaming", label: { en: "Streaming", hr: "Streaming" } },
      { key: "teleprompter", label: { en: "Teleprompter", hr: "Teleprompter" } },
      { key: "underwater_bodies", label: { en: "Underwater Camera Bodies", hr: "Podvodna kućišta" } },
      { key: "other_film_photo", label: { en: "Other in Film & Photography", hr: "Ostalo u filmu i fotografiji" } },
    ],
  },
  {
    key: "garden",
    label: { en: "Garden", hr: "Vrt" },
    subcategories: [
      { key: "garden_machinery", label: { en: "Garden Machinery", hr: "Vrtni strojevi" } },
      { key: "garden_tools", label: { en: "Garden Tools", hr: "Vrtni alati" } },
      { key: "garden_furniture", label: { en: "Garden furniture", hr: "Vrtni namještaj" } },
      { key: "ladder", label: { en: "Ladder", hr: "Ljestve" } },
      { key: "lawn_care", label: { en: "Lawn Care", hr: "Njega travnjaka" } },
      { key: "other_garden", label: { en: "Other in Garden", hr: "Ostalo u vrtu" } },
    ],
  },
  {
    key: "home",
    label: { en: "Home", hr: "Dom" },
    subcategories: [
      { key: "childrens_things", label: { en: "Children's Things", hr: "Dječje stvari" } },
      { key: "cleaning_laundry", label: { en: "Cleaning and Laundry", hr: "Čišćenje i pranje" } },
      { key: "kitchen", label: { en: "Kitchen", hr: "Kuhinja" } },
      { key: "moving", label: { en: "Moving", hr: "Selidba" } },
      { key: "personal_care", label: { en: "Personal Care", hr: "Osobna njega" } },
      { key: "pets", label: { en: "Pets", hr: "Kućni ljubimci" } },
      { key: "sewing_machine", label: { en: "Sewing Machine", hr: "Šivaći stroj" } },
      { key: "styling_decor", label: { en: "Styling & Decor", hr: "Stil i dekor" } },
      { key: "other_home", label: { en: "Other in Home", hr: "Ostalo u domu" } },
    ],
  },
  {
    key: "party",
    label: { en: "Party & Special Occasions", hr: "Zabava i svečane prigode" },
    subcategories: [
      { key: "clothes", label: { en: "Clothes", hr: "Odjeća" } },
      { key: "marquees", label: { en: "Marquees", hr: "Šatori" } },
      { key: "party_activities", label: { en: "Party Activities", hr: "Zabavne aktivnosti" } },
      { key: "party_decoration", label: { en: "Party Decoration", hr: "Dekoracije" } },
      { key: "party_furniture", label: { en: "Party Furniture", hr: "Namještaj" } },
      { key: "party_kitchen", label: { en: "Party Kitchen", hr: "Kuhinja za zabave" } },
      { key: "party_combos", label: { en: "Party combos", hr: "Party paketi" } },
      { key: "patio_heater", label: { en: "Patio Heater", hr: "Grijalica za terasu" } },
      { key: "sound_light_scene", label: { en: "Sound, Light & Scene", hr: "Zvuk, rasvjeta i scena" } },
      { key: "other_party", label: { en: "Other in Party", hr: "Ostalo u zabavi" } },
    ],
  },
  {
    key: "sports_leisure",
    label: { en: "Sports & Leisure", hr: "Sport i razonoda" },
    subcategories: [
      { key: "aid", label: { en: "Aid", hr: "Pomagala" } },
      { key: "cycling", label: { en: "Cycling", hr: "Biciklizam" } },
      { key: "musical_instrument", label: { en: "Musical Instrument", hr: "Glazbeni instrument" } },
      { key: "outdoor_life", label: { en: "Outdoor Life", hr: "Boravak na otvorenom" } },
      { key: "play_hobby", label: { en: "Play & hobby", hr: "Igra i hobi" } },
      { key: "sports", label: { en: "Sports", hr: "Sport" } },
      { key: "training_gym", label: { en: "Training & Gym", hr: "Trening i teretana" } },
      { key: "travel", label: { en: "Travel", hr: "Putovanja" } },
      { key: "watersports", label: { en: "Watersports", hr: "Vodeni sportovi" } },
      { key: "winter_sports", label: { en: "Winter Sports", hr: "Zimski sportovi" } },
      { key: "other_sports_leisure", label: { en: "Other in Sports and Leisure", hr: "Ostalo u sportu i razonodi" } },
    ],
  },
  {
    key: "vehicle",
    label: { en: "Vehicle", hr: "Vozila" },
    subcategories: [
      { key: "boat", label: { en: "Boat", hr: "Brod" } },
      { key: "car_accessories", label: { en: "Car Accessories", hr: "Dodatna oprema za auto" } },
      { key: "horsebox", label: { en: "Horsebox", hr: "Prikolica za konje" } },
      { key: "mc_accessories", label: { en: "MC & accessories", hr: "Motocikli i oprema" } },
      { key: "recreational_vehicle", label: { en: "Recreational vehicle", hr: "Kamp vozilo" } },
      { key: "trailers", label: { en: "Trailers", hr: "Prikolice" } },
      { key: "workshop", label: { en: "Workshop", hr: "Radionica" } },
      { key: "other_vehicles", label: { en: "Other Vehicles", hr: "Ostala vozila" } },
      { key: "other_vehicle", label: { en: "Other in Vehicles", hr: "Ostalo u vozilima" } },
    ],
  },
  {
    key: "other",
    label: { en: "Other", hr: "Ostalo" },
    subcategories: [{ key: "other", label: { en: "Other", hr: "Ostalo" } }],
  },
];

export const getCategoryLabel = (lang: Lang, key: CategoryKey) =>
  categories.find((c) => c.key === key)?.label[lang] ?? key;

export const getSubcategoryLabel = (lang: Lang, categoryKey: CategoryKey, subKey: string) =>
  categories
    .find((c) => c.key === categoryKey)
    ?.subcategories.find((s) => s.key === subKey)?.label[lang] ?? subKey;

export const getSubcategories = (categoryKey: CategoryKey | "") =>
  categories.find((c) => c.key === categoryKey)?.subcategories ?? [];
