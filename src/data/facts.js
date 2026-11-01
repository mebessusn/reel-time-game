// Fish facts for the loading screen and the title screen (true facts about the real fish).
export const FISH_FACTS = [
  'Bluegill fan out round nests in the shallows, and the males guard them.',
  'Yellow perch have stripes that help them hide among reeds.',
  'Catfish taste with their whole bodies: they have taste buds all over their skin.',
  'A walleye’s big glassy eyes help it hunt in low light, which is why it bites at dusk.',
  'Rainbow trout that go to sea and come back are called steelhead.',
  'Northern pike can lunge from a standstill faster than you can blink.',
  'Koi can live for decades; some have been recorded living over 100 years.',
  'Lake sturgeon can live longer than people and grow longer than a canoe paddle twice over.',
  'Sockeye salmon turn bright red when they swim upstream to spawn.',
  'Paddlefish filter tiny plankton from the water with their huge open mouths.',
  'Pufferfish puff up by gulping water fast when they feel threatened.',
  'Arctic char live farther north than any other freshwater fish.',
  'Longnose gar can gulp air, so they survive in warm, still water other fish avoid.',
  'Carp were kept in ponds as food fish for thousands of years.',
  'Muskellunge are called "the fish of ten thousand casts" because they are so hard to catch.',
  'Fish can see colour. Many see ultraviolet light too.',
  'A fish’s scales grow rings like a tree, so you can tell its age.',
  'Smallmouth bass love rocky, clear water and fight hard for their size.',
  'Crappie school around sunken branches and bite best at dusk.',
  'Golden shiners are a favourite food of bass, pike and herons alike.',
];
export const randomFact = () => FISH_FACTS[Math.floor(Math.random() * FISH_FACTS.length)];
