// Only records explicitly assigned to an exemplar can become specimen hotspots.
// Remaining studies are accessible in the branch overview with their original wording.
export const specimens = {
  "Ephydatia muelleri": [
    "Digestive-chamber signaling",
    "Contractile sheets",
    "Flush clogged canals",
  ],
  "Trichoplax adhaerens": [
    "Gliding hairs",
    "Digestive secretory cells",
    "Park over food",
    "Digest food on the spot",
  ],
  "Tripedalia cystophora": [
    "Eye-bearing sensory centers",
    "Learn to avoid obstacles",
  ],
  "Hydra vulgaris": [
    "Body-wide activity networks",
    "Shorten the body",
    "Lengthen in response to light",
  ],
  "Mnemiopsis leidyi": ["Continuous nerve net"],
  "Dugesia japonica": [
    "Planarian brain",
    "Choose between food cues and light",
    "Follow chemical cues",
  ],
  "Caenorhabditis elegans": [
    "Longitudinal nerve bundles",
    "Search circuit",
    "Search near a lost meal",
  ],
  "Drosophila melanogaster": [
    "Heading compass",
    "Visual lobes",
    "Keep a heading in the dark",
    "Orient to landmarks",
  ],
  "Apis mellifera": ["Mushroom bodies", "Remember a rewarded odor"],
  "Octopus vulgaris": ["Vertical lobe", "Acquire lasting memories"],
  "Octopus bimaculoides": ["Contact-taste receptors", "Taste a surface"],
  "Sepia officinalis": [
    "Skin pigment organs",
    "Skin bump muscles and nerves",
    "Change the skin pattern",
    "Hold a bumpy texture",
  ],
  "Branchiostoma lanceolatum": ["Frontal eye"],
  "Gnathonemus petersii": ["Electric-sense lobe", "Learn while sensing"],
  "Mustelus canis": ["Paired smell inputs", "Follow an odor plume"],
  "Carassius auratus": ["Spatial-memory forebrain", "Remember a place"],
  "Xenopus laevis": [
    "Swimming command neurons",
    "Midbrain steering pathways",
    "Start swimming after a touch",
    "Steer after a touch",
  ],
  "Hydromantes italicus": [
    "Visual orienting center",
    "Distinguish moving shapes",
  ],
  "Corvus corone": ["Report a faint visual stimulus"],
  "Corvus brachyrhynchos": [
    "Tool-related circuits",
    "Prepare to use a stone tool",
  ],
  "Monodelphis domestica": [
    "Whisker touch area",
    "Locate touch on the whiskers",
  ],
  "Mus musculus": [
    "Six-layer neocortex",
    "Corpus callosum",
    "Process visual patterns",
  ],
  "Ornithorhynchus anatinus": [
    "Electric-field receptors in the bill",
    "Locate a source of electricity",
  ],
  "Rousettus aegyptiacus": [
    "Three-dimensional place cells",
    "Represent a flight path in three dimensions",
  ],
  "Tursiops truncatus": [
    "Approach a distant target",
    "Switch how clicks are grouped",
  ],
  "Loxodonta africana": ["Neuron-rich cerebellum"],
  "Macaca mulatta": [
    "Action-responsive motor cortex",
    "Represent observed actions",
  ],
  "Homo sapiens": [
    "Identity-sensitive temporal neurons",
    "Speech-sensitive parietal cortex",
    "Recognize identity across images",
    "Form words silently",
  ],
};

// Original schematics with a sufficiently specific subject. A figure index is
// available for every stop, including species without a corresponding model.
export const models = {
  "Tripedalia cystophora": "nerve-nets",
  "Hydra vulgaris": "hydra-polyp",
  "Mnemiopsis leidyi": "comb-net-detail",
  "Dugesia japonica": "heads",
  "Drosophila melanogaster": "arthropod-brains",
  "Octopus vulgaris": "cephalopods",
  "Branchiostoma lanceolatum": "chordate-origins",
  "Xenopus laevis": "onto-land",
  "Mus musculus": "early-mammals",
  "Loxodonta africana": "mammal-radiations",
  "Homo sapiens": "primates-and-humans",
};
export function specimenRecords(stop, animal, group) {
  if (stop.exemplars.length === 1) return stop[group];
  const names = specimens[animal.scientific] || [];
  return stop[group].filter((r) => names.includes(r.name));
}
