// The 13 demo listings (same data as DEMO_ROWS in public/assets/js/main.js, which the localStorage pages still use).
// db/seed.js inserts these. ids 1-13 line up with the frontend ids, so favourites keep working.
// Statuses are deliberate: 9 approved and available, 1 approved but taken, 2 pending, 1 rejected.
module.exports = [
  {
    "id": 1,
    "title": "Sunrise Bedsit near Daystar Gate",
    "roomType": "bedsit",
    "rent": 7500,
    "location": "Daystar Gate, Athi River",
    "distance": 0.4,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "A bright self-contained bedsit a five-minute walk from the main gate. Tiled floor, own bathroom and a small cooking corner. Quiet compound with a night guard, popular with final-year students.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Fenced compound",
      "Own bathroom"
    ],
    "images": [
      "assets/images/bedroom-dark-wall.jpg",
      "assets/images/study-laptop.jpg",
      "assets/images/dining-kitchenette.jpg",
      "assets/images/bedroom-teal.jpg",
      "assets/images/exterior-brick.jpg"
    ],
    "contact": {
      "name": "Mama Njeri Properties",
      "phone": "0700 000 011",
      "email": "njeri@example.com"
    },
    "created": "2026-10-09"
  },
  {
    "id": 2,
    "title": "Budget Single Room, Kapiti Road",
    "roomType": "single",
    "rent": 4500,
    "location": "Kapiti Road, Athi River",
    "distance": 1.2,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Simple, clean single room with shared bathrooms. Water is reliable and the matatu stage is 2 minutes away. Best value for first-years on a tight budget.",
    "amenities": [
      "Water 24/7",
      "Fenced compound",
      "Near matatu stage"
    ],
    "images": [
      "assets/images/bedroom-window.jpg",
      "assets/images/desk-shelf.jpg",
      "assets/images/kitchen-wood.jpg",
      "assets/images/exterior-block.jpg"
    ],
    "contact": {
      "name": "Mr. Kamau Ochieng",
      "phone": "0700 000 012",
      "email": "kamau@example.com"
    },
    "created": "2026-10-10"
  },
  {
    "id": 3,
    "title": "Savannah Court One Bedroom",
    "roomType": "one_bedroom",
    "rent": 16000,
    "location": "Mlolongo",
    "distance": 5.8,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Modern furnished one-bedroom with a full kitchen, fast fibre Wi-Fi and backup power. Gated compound with parking. Ideal if you want a calm place to study or to share with a friend.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Fenced compound",
      "Parking",
      "Furnished",
      "Own bathroom",
      "Kitchen",
      "Backup power"
    ],
    "images": [
      "assets/images/living-blue-sofa.jpg",
      "assets/images/bedroom-lamps.jpg",
      "assets/images/kitchen-dining-modern.jpg",
      "assets/images/living-leather-sofa.jpg",
      "assets/images/bedroom-mountain.jpg"
    ],
    "contact": {
      "name": "Savannah Court Ltd",
      "phone": "0700 000 013",
      "email": "savannah@example.com"
    },
    "created": "2026-10-11"
  },
  {
    "id": 4,
    "title": "Athi Hostel (Women only)",
    "roomType": "hostel",
    "rent": 5500,
    "location": "Athi River Town",
    "distance": 2.1,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Women-only hostel with shared kitchen and a study lounge. Security guard on duty day and night. Rent includes water and Wi-Fi.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Fenced compound",
      "Kitchen"
    ],
    "images": [
      "assets/images/hostel-bunks-bright.jpg",
      "assets/images/bunk-room.jpg",
      "assets/images/kitchen-shared.jpg",
      "assets/images/desk-shelf.jpg",
      "assets/images/exterior-apartments.jpg"
    ],
    "contact": {
      "name": "Mrs. Achieng Otieno",
      "phone": "0700 000 014",
      "email": "achieng@example.com"
    },
    "created": "2026-10-12"
  },
  {
    "id": 5,
    "title": "Cosy Shared Room, Two Sharing",
    "roomType": "shared",
    "rent": 3500,
    "location": "Stoni Athi",
    "distance": 3.4,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Two students share a spacious room with double-decker beds and lockers. Cheapest option in the area. Bring your own mattress cover.",
    "amenities": [
      "Water 24/7",
      "Fenced compound",
      "Near matatu stage"
    ],
    "images": [
      "assets/images/bunk-desk.jpg",
      "assets/images/bunk-plain.jpg",
      "assets/images/study-laptop.jpg",
      "assets/images/kitchen-steel.jpg"
    ],
    "contact": {
      "name": "Mama Njeri Properties",
      "phone": "0700 000 011",
      "email": "njeri@example.com"
    },
    "created": "2026-10-13"
  },
  {
    "id": 6,
    "title": "Kitengela Single with Own Bathroom",
    "roomType": "single",
    "rent": 8500,
    "location": "Kitengela",
    "distance": 7.9,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Single room with an en-suite bathroom in a modern block. Further from campus but on the main road with frequent matatus.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Fenced compound",
      "Parking",
      "Own bathroom"
    ],
    "images": [
      "assets/images/bedroom-teal.jpg",
      "assets/images/bedroom-window.jpg",
      "assets/images/studio-living.jpg",
      "assets/images/exterior-block.jpg"
    ],
    "contact": {
      "name": "Mr. Kamau Ochieng",
      "phone": "0700 000 012",
      "email": "kamau@example.com"
    },
    "created": "2026-10-14"
  },
  {
    "id": 7,
    "title": "Syokimau Executive Bedsit",
    "roomType": "bedsit",
    "rent": 11000,
    "location": "Syokimau",
    "distance": 9.3,
    "availability": "taken",
    "status": "approved",
    "rejectionReason": null,
    "description": "Furnished bedsit near the Syokimau railway station. Currently fully occupied; check back next semester.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Fenced compound",
      "Furnished",
      "Own bathroom",
      "Backup power"
    ],
    "images": [
      "assets/images/bedroom-mountain.jpg",
      "assets/images/studio-living.jpg",
      "assets/images/kitchen-dining-modern.jpg",
      "assets/images/exterior-modern.jpg"
    ],
    "contact": {
      "name": "Savannah Court Ltd",
      "phone": "0700 000 013",
      "email": "savannah@example.com"
    },
    "created": "2026-10-15"
  },
  {
    "id": 8,
    "title": "Lukenya View Single Room",
    "roomType": "single",
    "rent": 5000,
    "location": "Lukenya",
    "distance": 6.5,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Peaceful single room with a view of the hills. Water tank and backup power. Short boda-boda ride to campus.",
    "amenities": [
      "Water 24/7",
      "Fenced compound",
      "Backup power"
    ],
    "images": [
      "assets/images/bedroom-attic.jpg",
      "assets/images/study-laptop.jpg",
      "assets/images/kitchen-wood.jpg",
      "assets/images/exterior-apartments.jpg"
    ],
    "contact": {
      "name": "Mrs. Achieng Otieno",
      "phone": "0700 000 014",
      "email": "achieng@example.com"
    },
    "created": "2026-10-16"
  },
  {
    "id": 9,
    "title": "Mavoko Student Bedsit",
    "roomType": "bedsit",
    "rent": 6800,
    "location": "Mavoko",
    "distance": 1.8,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Affordable bedsit with Wi-Fi included. Walking distance to shops, a salon and a small gym.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Fenced compound",
      "Own bathroom",
      "Near matatu stage"
    ],
    "images": [
      "assets/images/desk-shelf.jpg",
      "assets/images/bedroom-dark-wall.jpg",
      "assets/images/dining-kitchenette.jpg",
      "assets/images/exterior-block.jpg"
    ],
    "contact": {
      "name": "Mama Njeri Properties",
      "phone": "0700 000 011",
      "email": "njeri@example.com"
    },
    "created": "2026-10-17"
  },
  {
    "id": 10,
    "title": "Katani Shared Two-Bedroom",
    "roomType": "shared",
    "rent": 4200,
    "location": "Katani",
    "distance": 4.7,
    "availability": "available",
    "status": "approved",
    "rejectionReason": null,
    "description": "Share a two-bedroom house with three other students. Own bed and shelf, shared kitchen and living room.",
    "amenities": [
      "Water 24/7",
      "Fenced compound",
      "Kitchen"
    ],
    "images": [
      "assets/images/hostel-tv.jpg",
      "assets/images/bunk-room.jpg",
      "assets/images/living-white-sofa.jpg",
      "assets/images/kitchen-steel.jpg",
      "assets/images/exterior-apartments.jpg"
    ],
    "contact": {
      "name": "Mr. Kamau Ochieng",
      "phone": "0700 000 012",
      "email": "kamau@example.com"
    },
    "created": "2026-10-18"
  },
  {
    "id": 11,
    "title": "New Bedsit, EPZ Road",
    "roomType": "bedsit",
    "rent": 7000,
    "location": "EPZ Road, Athi River",
    "distance": 2.6,
    "availability": "available",
    "status": "pending",
    "rejectionReason": null,
    "description": "Newly built bedsits, just completed. Waiting for approval.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Fenced compound",
      "Own bathroom"
    ],
    "images": [
      "assets/images/bedroom-lamps.jpg",
      "assets/images/studio-kitchenette.jpg",
      "assets/images/exterior-modern.jpg"
    ],
    "contact": {
      "name": "Savannah Court Ltd",
      "phone": "0700 000 013",
      "email": "savannah@example.com"
    },
    "created": "2026-10-19"
  },
  {
    "id": 12,
    "title": "Kinanie Single Room",
    "roomType": "single",
    "rent": 3900,
    "location": "Kinanie",
    "distance": 5.2,
    "availability": "available",
    "status": "pending",
    "rejectionReason": null,
    "description": "Basic single room, tap water, fenced compound.",
    "amenities": [
      "Water 24/7",
      "Fenced compound"
    ],
    "images": [
      "assets/images/bunk-plain.jpg",
      "assets/images/kitchen-wood.jpg"
    ],
    "contact": {
      "name": "Mrs. Achieng Otieno",
      "phone": "0700 000 014",
      "email": "achieng@example.com"
    },
    "created": "2026-10-20"
  },
  {
    "id": 13,
    "title": "Luxury Penthouse Studio",
    "roomType": "one_bedroom",
    "rent": 45000,
    "location": "Nairobi Expressway",
    "distance": 28,
    "availability": "available",
    "status": "rejected",
    "rejectionReason": "Too far from Daystar (28 km). Please list properties within 10 km of the campus.",
    "description": "Studio far from campus.",
    "amenities": [
      "Wi-Fi",
      "Water 24/7",
      "Security guard",
      "Parking",
      "Furnished"
    ],
    "images": [
      "assets/images/living-leather-sofa.jpg",
      "assets/images/living-bright.jpg",
      "assets/images/kitchen-dining-modern.jpg"
    ],
    "contact": {
      "name": "Mr. Kamau Ochieng",
      "phone": "0700 000 012",
      "email": "kamau@example.com"
    },
    "created": "2026-10-21"
  }
];
