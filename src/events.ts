// NOTE: do not add a trailing comma or the script will fail

export type Event = {
  // Unique id, this is used in the URL so URLencoded is better
  id: string;
  date: string;
  title: string;
  // path to image
  img?: string;
  descriptionShort: string;
  descriptionLong?: string;
  fee: string;
  feeAk?: string;
  /* Link to the ticket shop, i.e. https://pretix.eu/carousel/131124Crocodiles/ */
  shopLink?: string;
  artists: Array<{
    name: string;
    image?: string;
    link?: string;
    description?: string;
    soundcloud?: string;
    youtube?: string;
    bandcamp?: string;
  }>;
};

export const events: Event[] = [
  {
    id: "carouslam-1-05-16-2024",
    date: "2024-05-16T20:00:00",
    title: "CarouSlam I: Busted Head Racket 🥊 Socke",
    fee: "10€, Kombi-Preis mit CarouSlam II: 15€",
    descriptionShort:
      "Am 16. und am 17. Mai lädt euch der Goldesel zum CarouSlam '24 ins Autohaus ein!\n\n Los geht es am 16. Mai mit Teil eins: auf der einen Seite stehen Busted Head Racket, feinster eggy Synth Punk aus Australien, welche vor drei Wochen bei Erste Theke Tonträger (aus Mannheim mit dem Spezialgebiet: arschgeile Mucke) ihr Album Go Go Go! veröffentlichten und nun auf Europatournee auch bei uns auf die Matte bringen werden. Finishing Move: Pitch Wheel Drop. \n\n Auf der anderen Ringseite warten die wenig kuscheligen Heidelberger Socke mit P-P-P-Punk um euch links zu drehen! Finishing Move: Axe Africa Bomber.",
    artists: [
      {
        name: "Busted Head Racket",
        link: "https://bustedheadracket.bandcamp.com/",
        description:
          "Originally starting out as a solo bedroom project for bassist-vocalist Arden Guff, Busted Head Racket, have been one of leading bands in the current Newcastle punk scene. Their radiant energy of unrestrained and hyper-accelerated synth-punk recently earned them an opening spot for rising Nashville punks Snõõper. Following up last year's split tape with weirdo German punk Teo Wise, the trio that now includes Guff, keyboardist Dave Cunningham, and drummer Riley Gardiner, have a new 8-track EP out today called Junk Food.",
        youtube:
          "https://www.youtube.com/embed/Eu6Qv_ySFgo?si=cGZX-9ECsip4VDQZ",
        soundcloud:
          "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1376989297&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true",
      },
      {
        name: "Socke",
        description:
          "Legendäre Heidelberger Punk Band, muss man nicht viel zu sagen.",
      },
    ],
  },

  {
    id: "carouslam-2-05-17-2024",
    date: "2024-05-17T20:00:00",
    title: "CarouSlam II: The Whiffs 🥊 City Boys",
    fee: "10€, Kombi-Preis mit CarouSlam I: 15€",

    descriptionShort:
      "CarouSlam Runde zwei startet am 17. Mai ab 20:00 im Autohaus! \n\n Die Herausforderer in der einen Ringecke kommen aus Kansas City, beherrschen Power Pop in so gut wie allen Facetten in Perfektion: The Whiffs! Letztes Jahr erschien Scratch ‘N’ Sniff, das bereits dritte Werk, gespickt mit einem Hit nach dem anderen, auf Dig! Records (bzw. in Europa auf dem legendären Label Bachelor Records) und knüpft nahtlos an die vorangegangenen Veröffentlichungen Take A Whiff und Another Whiff. Finishing Move: Double Knee Heartbreaker. \n\nDie Gastgeber in der anderen Ecke kennen jeden Quadratzentimeter des Carousels und versuchen mit Croonern im ¾ Takt über Bullet Dancing Western Nummern bis zu schnellen Pub Rockern den Gästen aus Missouri Paroli zu bieten. Die Hinrunde vor zwei Jahren in der Villa Nachttanz ging jedenfalls ordentlich in die Magengrube! Finishing Move: C# Shooter.Wer wird den Gürtel am Ende umschnallen? Kommt rum und findet es raus!",
    artists: [
      {
        name: "The Whiffs",
        description:
          "This album just feels like America. It transports me to some mythical dive bar where The Replacements, Tom Petty, and Cheap Trick still rule the jukebox. — Faster And Louder",
        youtube: "https://www.youtube.com/embed/6dM2rAb-RL8",
        link: "https://www.thewhiffsband.com/",
      },
      {
        name: "City Boys",
        link: "https://city-boys.bandcamp.com/",
        description:
          "Auf Gleis 7 schaufeln die City Boys ordentlich Kohlen in den Kessel des Country-Schrammelpop-Zugs auf dem Weg von Heidelberg nach Shelbyville. Toot-toot, bei 90/mph wollen alle sofort einen Line Dance aufs Parkett vom Bordbistro legen. Gitarre, Schlagzeug und Bass schlingern roadrunnermäßig um die 3/4 Akkord-Kurve. Jetzt erstmal einen Stopp bei Tank & Rast.",
        youtube: "https://www.youtube.com/embed/hpMjJ-4r-iM",
      },
    ],
  },

  {
    id: "forest-ray-28-05-2024",
    date: "2024-05-28T20:00:00",
    title: "Forest Ray ❤️ The Roaring 420s",
    fee: "Spendenbasis",
    img: "/img/forest_ray.jpg",
    descriptionShort: `Auch in diesem Jahr möchte der Goldesel wieder einen Beitrag zum Deutsch-Amerikanischen Freundschaftsfest leisten. Im Autohaus kurbeln wir daher am 28. Mai um 20 Uhr sämtliche Seitenscheiben runter, hängen das linke Bein zum Fenster raus (Automatik!), stellen die Lauscher auf und das Autoradio auf 98,7. Wolfman Jack heult los und kündigt Forest Ray zur Live-Session an.

        Die Psych-Rocker Kombo aus Seattle startet mit Please Be Nice To Me ihren V8 auf Benzos. Sämtliche Kofferraumdeckel  fangen an zu wummern, die B-Bender sorgen für angenehme Kurvenlage! Kräftiger Kickdown im Anflug, aber keinem verrutscht an diesem Abend das Bier auf der Rückbank. Doch was wäre so ein staubiger Roadtrip ohne Companion? Genau, nur ein Ghost on a Highway. Über die Route B96 kommen zum Glück die Roaring 420s aus Dresden zur Rettung!
        
        Und hinterher trinken alle noch 2 Bourbon Whisky im Soft Rock Cafe.`,
    artists: [
      {
        name: "Forest Ray",
        description:
          "Forest Ray is a psychedelic rock project whose dedication to analog recording has harbored a darker, older and more intimate sound. Forest Ray's music combines guitar driven psychedelic rock with tinges of raw synth-laced post-punk, Tropicalia flute and uninhibited performances that embody the garage punk aesthetic that fueled the group's creation ",
        youtube: "https://www.youtube.com/embed/I6estL4fqvI",
        link: "https://forestray.bandcamp.com/",
      },
      {
        name: "The Roaring 420s",
        link: "https://theroaring420s.bandcamp.com/album/the-roaring-420s",
        description:
          "Blending surf rock and late 60s pre-Punk into Eastern psychedelia The Roaring 420s from Dresden, Germany, rather sound like an obscure little gem discovered at a garage sale in California. Roughly located somewhere between The Beach Boys and The Velvet Underground, they’re bursting out with twangy guitars, groovin' organ and an electric sitar! ",
        youtube: "https://www.youtube.com/embed/-psBFcQ8t-k",
      },
    ],
  },

  {
    id: "hdf-31-05-2024",
    date: "2024-05-31T19:00:00",
    title: "Hodi Flow Hodilicious Release Party",
    fee: "Spendenbasis",
    img: "/img/hodi_flow.jpg",
    descriptionShort: `Hallo Freunde der Sonne. Am 31.05.2024 findet die "Hodilicious" Release Party im Carousel statt. Hodi Flow und DJ Soundtrax aus Köln präsentieren das neue Album mit satten Hip Hop Beats und Lyrics, die ihresgleichen suchen. Special Acts aus der Region werden ebenfalls am Start sein und die Hütte zum Beben bringen. Kommt vorbei! Ihr werdet es nicht bereuen 😉`,
    artists: [
      {
        name: "Hodi Flow",
        description:
          "Das lang ersehnte Album, 'Hodilicious', von Hodi Flow in Zusammenarbeit mit DJ Soundtrax hat nun den Weg ans Tageslicht gefunden. Mit satten HipHop Beats und Lyrics, die seinesgleichen suchen, wird Heidelbergs Hip Hop erneut auf die Bildfläche projiziert und zeigt sich hierbei von seiner besten Seite. Neben der Möglichkeit die Lieder auf Musik-Streaming Plattformen zu hören, können Hörer das Album nun auch als Vinyl oder Kassette erwerben.",
        youtube: "https://www.youtube.com/embed/8hAQjFlv7jU",
        link: "https://breakinallrecords.bandcamp.com/album/hodilicious",
      },
    ],
  },
  {
    id: "sommer-2024",
    date: "2024-06-22T16:00:00",
    title: "Carousel Sommerfest",
    fee: "",
    img: "/img/sommerfest_flyer.png",
    descriptionShort: `Endlich Sommer im Autohaus! Am 22. Juni holen wir Tante Renates Cabrio aus der Garage und laden euch auf eine rasante Spritztour ein. 🚗

Wir starten um 16 Uhr mit einem Donut im Hof und jeder Menge Action draußen wie drinnen. Euch erwarten:

- 🎨 kreative Workshops: Makramee Blumenampel mit Fenja, freies Malen für Kids (2-10 Jahre) mit Studio Kritzel Kratzel oder Bügeln gegen das Patriarchat mit FemiHD

- 🎠 ein schwindelerregendes Kleiderkarussell (tausche alte gegen neue Styles, bäm!)

- 👖Flohmarkt: meldet euch gerne vorab (über Insta oder per Mail an carouselev@gmail.com), wenn ihr mitmachen wollt, Tische sind vorhanden.

- 🍔 etwas Leckeres zu essen von Erick’s Tacos & Eis vom N’Ice Bike.

- 🏓 Tischtennis-Action mit dem Ping Pong Social Club.

- 🎶 DJs, DJs, DJs! @lockedphase, Joschka Epiterra, @tretgold und GiuNi Tunes

- 🥁 Live-Musik mit Jimson Drift, Beach Towel (als Duo-Infernale), Bonfire Orchestra, Glider, Novitchok und Turbo Mars Soundsystem

- 🎆 Visuals von Bani Vardigans

Kurbelt eure Verdecks zurück, bringt gute Laune und eure Friends mit. Wir freuen uns auf euch und schalten schon mal in den 3. Gang.

Der Eintritt ist frei!

Das Sommerfest ist ein Projekt im Rahmen des Förderprogramms „Mehr junge Feierkultur“. Unterstützt vom Stadtjugendring Heidelberg und hdn8.de 🙏`,
    artists: [
      {
        name: "Beach Towel",
        youtube: `https://youtube.com/embed/hQjNV-fDMaU`,
      },
      {
        name: "Novitchok",
        youtube: "https://youtube.com/embed/ZtvqZdkan9g",
      },
      {
        name: "Bonfire Orchestra",
        youtube: "https://youtube.com/embed/QSVKgdivYac",
      },
      {
        name: "Jimson Drift",
        youtube: "https://youtube.com/embed/7jkGz_NHcT8",
      },
      {
        name: "Rico Banton",
        youtube: "https://youtube.com/embed/Sye9lUPlqnY",
      },
      {
        name: "Glider",
        youtube: "https://youtube.com/embed/Gb9YfYRh-KQ",
      },
    ],
  },
  {
    id: "loons-mustang-fang",
    date: "2024-07-11T20:00:00",
    title:
      "The Loons (Psychedelic Garage Beat aus San Diego, Kalifornien) mit Mustang Fang (Karlsruhe)",
    fee: "",
    img: "/img/loons.png",
    descriptionShort: `Sixties Garage Sound, als käme er direkt von einer der legendären Nuggets Compilations zur amerikanischen Psychedelic Welle ab Mitte der Sechziger Jahre ist das, wozu der Goldesel euch am 11. Juli ins Carousel im Autohaus einlädt! The Loons drehen sich um Mike Stax (zuvor bei The Crawdaddys und The Tell-Tale Hearts und Herausgeber von Ugly Things Magazine), wurden 1997 gegründet, veröffentlichten seitdem fünf Alben auf den einschlägigen Labels wie BOMP! und Get Hip Recordings und touren nun mit dem neuesten Werk “Memories Have Faces” (Munster Records), um euch die buchstäblichen Faces mit ihrem Fuzz-durchtränkten Sound zu melten!

Bevor wir uns in den Sechzigern wähnen, gibt es eine Dosis Country-Glitch-Hop von Mustang Fang auf die Lauscher.`,
    artists: [
      {
        name: "The Loons",
        youtube: `https://youtube.com/embed/YnDbOZXJ0ro`,
      },
      {
        name: "Mustang Fang",
        youtube: "https://youtube.com/embed/N_2srIvBDI8",
      },
    ],
  },
  {
    id: "wurst-durst",
    date: "2024-07-14T14:00:00",
    title: "Wurst & Durst",
    fee: "",
    img: "/img/wurst_durst.jpg",
    descriptionShort: `Flanell Aktuell schmeißen den Grill an und ihr könnt bisschen die Ateliers anschauen, snacken, trinken…auf gemütlich!

Gerne auch eigenes Grillgut mitbringen, wenn ihr großen Hunger habt :)

14:00-18:00 Uhr
 `,
    artists: [],
  },
  {
    id: "dgf_wild-mustang",
    date: "2024-07-27T20:00:00",
    title: "Die Groben Fetten / Wild Mustang",
    fee: "",
    img: "/img/dgf_wild_mustang.jpg",
    descriptionShort: `DIE GROBEN FETTEN sind DER Headliner des Lametta & Wurst Festivals, welches es aber aus uns unerfindlichen Gründen noch immer (2024!) nicht gibt. Aus einem schimmligen Würzburger Keller haben sie es in nur 10 Jahren erstaunlich schnell und stilsicher ans Tageslicht geschafft und leben irgendwo zwischen Rügenwald und Ostpommern ein Leben auf der Überholspur. Fettige Ohrwürmer, Synthi und Nasenflöte, sowie ein ordentliches Pfund gehackte Anarcho-Performance, versprechen einen Abend, an dem auch mal mitgesungen werden darf. 

Auf dem Rücken des WILD MUSTANG galoppieren wir durch lo-fi Countryland in den Sunset vom Autohaus. Bittersweete Melodien sind sein Leben und trotz staubigster Prärie: hier bleibt garantiert kein Auge trocken!   `,
    artists: [
      {
        name: "Die Groben Fetten",
        youtube: `https://www.youtube.com/embed/XBFSX3olM1Y`,
      },
      {
        name: "Wild Mustang",
        youtube: "https://www.youtube.com/embed/izYhyltt9fU",
      },
    ],
  },
  {
    id: "cool-sorcery",
    date: "2024-09-11T19:00:00",
    title: "Cool Sorcery (Brasilien) und Zyph (Mannheim)",
    fee: "10€",
    img: "/img/cool sorcery, zyph.jpg",
    descriptionShort: `Synth Punk's not dead! Jedenfalls nicht wenn es nach uns und Cool Sorcery geht. Und nein, die sind nicht aus Down Under sondern aus Brasilien, oha! Während die Alben weitestgehend alleine von Marcos Assis geschrieben, eingespielt, aufgenommen, gemischt und gemastered sind, muss er auf der Bühne nicht einen auf Hyper One-Man-Band machen, sondern spielt mit kompletter Band auf. Das neue Album heißt Terra Invaders, beinhaltet zahlreiche Features, handelt von uns überlegenen Aliens und ist eine spannende Mischung aus eggy Punk und Psych Jams.

Uns aus der Sommerpause holen werden uns Zyph aus Mannheim, freshe Band, reißender Punk auf Deutsch. Pogo Kompatibilität 10/10.`,
    artists: [
      {
        name: "Cool Sorcery",
        link: "https://distrokid.com/hyperfollow/coolsorcery/terra-invaders",
        bandcamp: `https://bandcamp.com/EmbeddedPlayer/album=3272968982/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/`,
        youtube: "https://www.youtube.com/embed/1P3v6h1gZoc",
      },
      {
        name: "Zyph",
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/album=2131561424/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/",
      },
    ],
  },
  {
    id: "kino-1309",
    date: "2024-09-13T21:00:00",
    title: "Open air kino: Repo Man",
    img: "/img/woanderskino-1309.jpeg",
    descriptionShort:
      "Open air kino im Autohaus. Karlstorkino Midnight Madness zeigt Repo Man im Hinterhof. Es geht los bei Anbruch der Dunkelheit. <a href='https://www.karlstorkino.de/programm/repo-man/'>Mehr Infos</a>",
    fee: "Pay what you want",
    artists: [],
  },
  {
    id: "sluts-wkz-socke",
    date: "2024-10-05T20:00:00",
    title: "Sluts, WKZ und Socke",
    img: "/img/sluts_wkz_socke.jpg",
    descriptionShort: `Dreimal Deutschpunk gibt es nachträglich zum Tag der Deutschen Einheit am 5. Oktober im Carousel! Zweimal Routiniers und einmal unveröffentlicht und frisch aus dem Proberaum. 

Sluts, die Unkaputtbaren der ersten Welle, in X-ter Besetzung nun (wieder? wer blickt da durch!) mit Diesel am Bass und Gesang, Pelle an der Gitarre (schon in der Braunschweiger pre-Sluts Kombo Bombed Bodies dabei) und Martin an den Drums spielen die Klassiker der Bäh! (Aggressive Rockproduktionen), Deep Cuts der späteren Heidelberger Inkarnation (als Sluts’n) und falls wir es verdienen auch 1-2 neue Stücke direkt aus dem Proberaum.

Die Wehrkraftzersetzer (kurz WKZ) gründeten sich, als die Sluts bereits ihre erste Trennung (1982) hinter sich hatten, um 1983 rum und veröffentlichten 1986 ihre LP Echte Punx. Die Ludwigshafener Band wechselten die Besetzung bestimmt so oft wie die Sluts und sind ebenso aktiv.

Fast 40 Jahre Vorspulen…: Pogo Alarm löst die Band Socke seit einigen Monaten regelmäßig in und um Heidelberg aus. Man munkelt, es wären Aufnahmen in der Mache und seit dem letzten Auftritt im Carousel ein Mitglied dazugekommen… Spannung und Vorfreude duellieren sich im Dosenstechen!

Flyer: <a href="https://www.instagram.com/julian.grmn/">@julian.grmn</a>
`,
    fee: "10€",
    artists: [
      {
        name: "Sluts",
        youtube: "https://www.youtube.com/embed/dHS96Wgkw9c",
      },
      {
        name: "Die Wehrkraftzersetzer (WKZ)",
        youtube: "https://www.youtube.com/embed/NQHzIbYWZbg",
      },
      {
        name: "Socke",
        link: "https://www.instagram.com/socke.band/",
      },
    ],
  },
  {
    id: "crocodiles_bird-control",
    date: "2024-11-13T19:00:00",
    title: "Crocodiles (San Diego) und Bird Control (Berlin)",
    img: "/img/crocodiles_bird-control.jpg",
    descriptionShort: `Alles dreht sich im Carousel, denn Crocodiles aus San Diego verlassen den Sumpf und touren im November durch Europa inkl. Stopp in Heidelberg! Die Kultband hat doppelten Grund zu feiern, denn neben dem hervorragenden Release Upside Down in Heaven vom letzten Jahr, erschien diesen Sommer eine Neuauflage vom Debut Summer of Hate zum 15. Jubiläum. Seitdem fliegt die Band um Brandon Welchez und Charles Rowell zwischen Space Rock (Spacemen 3), Post-Punk (Echo & The Bunnymen), Noise Pop (Jesus and Mary Chain) und Garage Rock ohne jemals den (Pop-)Song aus den Augen zu verlieren.

Ohne weitere Wortspiele aus der Fauna freuen wir uns, Bird Control aus Berlin als Special Guest begrüßen zu dürfen. Psychedelischen Garage Rock kann man auf dem Erstlingswerk Change The Drug, Keep The Dose hören und mehr von der Band mit Wurzeln in Heidelberg (Mucus 2) soll bald folgen.

Flyer: <a href="https://www.instagram.com/joey.controlletti/">@joey.controlletti</a>
`,
    fee: "15 Euro im VVK",
    shopLink: "https://pretix.eu/carousel/131124Crocodiles/",
    artists: [
      {
        name: "Crocodiles",
        link: "https://linktr.ee/killcrocodiles",
        youtube: "https://www.youtube.com/embed/eVR7041b7Ko",
      },
      {
        name: "Bird Control",
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/album=114426192/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/",
      },
    ],
  },
  {
    id: "tyvek_exceeded-capacity",
    date: "2024-11-15T20:00:00",
    title: "Tyvek (Detroit) und Exceeded Capacity (Heidelberg)",
    img: "/img/tyvek_exceeded-capacity.jpg",
    descriptionShort: `Die auffälligste Konstante der Band Tyvek aus Detroit war schon immer der kompromisslose Sound der Aufnahmen. Die Becken zischen, die Gitarren übersteuern, dem Gesang, der einzigen personellen Konstante der Band Kevin Boyer, wird weder Pause noch Headroom gegönnt, während der Bass dem ganzen das nötige Rumpeln verpasst. Lo-Fi wo man hinhört! Stilistisch haben Tyvek dem Grundsound des Garage Punk über die Jahre nie den Rücken gekehrt, wenn auch hier und da Noise und Drone Elemente bis zu No-Wave Saxofon-Anleihen ihren Weg in die meist sehr kompakt gehaltenen Stücke finden. Für die aktuelle Tour ergänzen die Langzeit-Kollaborateure Boyers Shelley Slant, Fred Thomas (beide u.a. von Saturday Looks Good To Me), Emily Roll und Alex Glendening.

Exceeded Capacity heißt die mysteriöse Band um Mitglieder von Røntgen und Novitchok und wird euch ein HC-Punk Brett vor den Latz knallen von dem ihr euch erst nach 10 Minuten Kryotherapie erholen werdet.

Flyer: <a href="https://www.instagram.com/joey.controlletti/">@joey.controlletti</a>
`,
    fee: "8€ VVK",
    shopLink: "https://pretix.eu/carousel/15112024tyvek/",
    artists: [
      {
        name: "Tyvek",
        image: "/img/ltd/tyvek_promo.jpg",
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/album=4142836287/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      },
    ],
  },
  {
    id: "data-unknown_poo-poo-talks",
    date: "2024-11-30T20:00:00",
    title: "Data Unknown (Indianapolis) und Poo Poo Talks (Rom)",
    img: "/img/data-unknown_poo-poo-talks.jpg",
    descriptionShort: `Last Call vor 2025! Und dieses Jahr endet mit einem Banger! Nicht einmal, nein, ganze zwei schnittige Bands, driften ins Carousel!
Zum einen aus der Heimatstadt des rasanten Indy 500, rasen Data Unknown mit nihilistischem Synth Punk und zum anderen aus der Stadt die einst bekannt war für ihre Streitwagenrennen, kommen Poo Poo Talks mit waschechtem Egg Punk di Roma! 
Kein anderer Jahresabschluss legt so den Turbo ein!

Flyer: <a href="https://www.instagram.com/joey.controlletti/">@joey.controlletti</a>
`,
    fee: "10€",
    artists: [
      {
        name: "Data Unknown",
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/album=1912446176/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      },
      {
        name: "Poo Poo Talks",
        description: `Poo Poo Talks are a fast and fun synth garage-rok power trio from Rome that mixes rock 'n' roll, garage, and alt-punk for a high-volume experience. In December 2023, they released a fully self-produced demo on cassette, which, along with their live performances, helped spread their music both in Italy and abroad. 
Rok is back!`,
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/album=725028460/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      },
    ],
  },
  {
    id: "yggdrasil",
    date: "2024-12-06T18:00:00",
    title: "Yggdrasil",
    img: "/img/yggdrasil.jpg",
    descriptionShort: `Lebe im Jetzt, warte nicht auf morgen;
      pflücke heute die Rosen des Lebens.
      Original: Lev i nuet, vent ikke til i morgen;
      plakk livets roser i dag.

      Es wird wieder Zeit, dass sich die Tore öffnen!

      Wir werden leider auch nicht jünger, aber wollen auf mindestens ein größeres Stampfen nicht verzichten.

      Es wird kalt, und wir laden euch ein, in unsere kleine neue Höhle zu kommen. Es wird kuschelig, es wird warmen Glühwein und Met geben. Draußen wird eine kleine gemütliche Oase für euch gestaltet.

      Auftakt ist am 6. Dezember 2024 um 18 Uhr. Kommt pünktlich, denn in der Höhle haben nur 199 Wikinger/innen Platz. Der Eintritt kostet 10 Euro und wird an den Carousel e.V. gehen.**

      Eine Einladung

      Bringt eure Liebsten mit!  

      Ein paar Fakten:
<ul>
<li> Es wird farbenfrohe Visuals von Jaime Ramirez und Phasensprung geben.</li>
<li> Die Location ist Hebelstraße 7, 69115 Heidelberg – nur 15 Minuten zu Fuß vom Heidelberger Hauptbahnhof entfernt.</li>
<li> Eine kleine Spendenkasse (Valhalla of Sound) wird an der Kasse für das nächste Stampfen im Freien 2025 stehen.</li>
<li> Verkleidet zu kommen ist total angesagt.</li>
<li> Warmer Glühwein und Met werden angeboten. Bringt bitte ggf. eine Tasse mit.</li>
<li> Rauchen in der Location ist nicht gestattet. Dafür bauen wir draußen eine Oase für euch auf.</li>
<li> Psycare wird vor Ort sein.</li>
<li> Ab 18 Jahren – Muttizettel zählen nicht.</li>
<li> Die Location ist barrierefrei.</li>
<li> Nicht wundern: Der Toilettenwagen steht vor dem Eingang.</li>
<li> Die Location bietet Platz für 199 Wikinger/innen.</li>
</ul>

      ᛚᛁᚾᛖ ᚢᛈ
      Line up:

      Solė Fía
      <a href='https://soundcloud.com/sole-fia'>https://soundcloud.com/sole-fia</a>

      Tret.Gold & Kappajota
      <a href='https://soundcloud.com/tret-gold'>https://soundcloud.com/tret-gold</a>
      <a href='https://soundcloud.com/djkappajota'>https://soundcloud.com/djkappajota</a>
      
      Takttrauma 
      <a href='https://soundcloud.com/takttrauma'>https://soundcloud.com/takttrauma</a>
          
      Pfeifenreiter
      <a href='https://soundcloud.com/pfeifenreiter'>https://soundcloud.com/pfeifenreiter</a>
      
      Milan Knete
      <a href='https://soundcloud.com/kneterich'>https://soundcloud.com/kneterich</a>
      
      Mak Eye
      <a href='https://soundcloud.com/markaraaa'>https://soundcloud.com/markaraaa</a>
      
      Project P with YenkY MC
      <a href='https://www.mixcloud.com/projectp/project-p-der-berg-ravt-safe-1/'>https://www.mixcloud.com/projectp/project-p-der-berg-ravt-safe-1/</a>


      <b>ᚹᛁᚱ ᚠᚱᛟᛇᛖᚾ ᚢᚾᛋ ᚨᚢᚠ ᛇᚢᛉᚺ – ᚨᚢᚠ ᚹᛁᚴᛁᛝᛖᚱᚨᚱᛏ</b>

      Wir freuen uns auf euch
  `,
    fee: "10€",
    shopLink: 'https://pretix.eu/carousel/24-12-06-yggdrasil/',
    artists: []
  },
  {
    id: "negative_gears",
    date: "2025-02-07T20:00:00",
    title: "Negative Gears (Sydney), Galeere (Heidelberg) und Monochrome Lights (Mannheim)",
    img: "/img/negative_gears.jpeg",
    descriptionShort: `Um dem kochendheißen australischen Sommer zu entkommen, nistet sich das Aussie-
Fünfgespann um Negative Gears im Carousel ein. Mit einem Sound der so wavey ist, dass er fast
aus dem Sand des Bondi-Beaches entsprungen sein könnte. Klingt ein bisschen wie Units oder
Crisis, wenn sie sich mit Gang Of Four den Neoprenanzug geteilt hätten!
Als Support sind die Mannheimer Post Punker von Monochrome Lights am Start, die mit düsteren
Sounds den Winter noch dunkler machen!
Aber damit nicht genug, auch Heidelberg's Finest Galeere gibt sich die Ehre und heizen euch ein!

Flyer: <a href="https://www.instagram.com/joey.controlletti/">@joey.controlletti</a>
`,
    fee: "10€",
    artists: [
      {
        name: "Negative Gears",
        image: "/img/negative_gears_photo.jpg",
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/album=3046476883/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=false/",
      },
      {
        name: "Monochrome Lights",
        image: "/img/monochrome_lights.jpg",
        bandcamp:
          "https://bandcamp.com/EmbeddedPlayer/track=2043034640/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      },
      {
        name: "Galeere",
        image: "/img/galeere.jpg"
      }
    ],
  }
,
  {
  "id": "sleeveens",
  "date": "2025-02-13T20:00",
  "title": "The Sleeveens (Nashville) und A Silly Walk (Heidelberg)",
  "descriptionShort": "Keine Atempause im Februar Carousel des Rock'n'Roll, denn schon am 13. geht es weiter mit den famosen The Sleeveens aus Nashville, U.S.A.! Klingt zwar eigentlich eher nach Dr. Feelgood und Stiff Little Fingers als nach Johnny Cash, macht euch also auf also auf Turbo gefasst! Als zweiten Trick zaubert der Goldesel die Heidelberger Lieblinge A Silly Walk endlich zum ersten Mal auf die Bühne im Carousel. Seit nunmehr 16 Jahren werden sie vom Ministerium des Garage Rock gefördert, um das Volk gefügig zu machen!\nEs gibt also keine Widerrede, es werden keine Importzölle verhängt: ran den Honigtopf des Rock’n’Rolls! Poster Art by @the_prints_of_persia",
  "descriptionLong": "",
  "fee": "10",
  "artists": [
    {
      "name": "The Sleeveens",
      "link": "https://thesleeveens.com/",
      "description": "When Irish-born Count Vaseline/The Mighty Stef songwriter Stef Murphy met Stiff Little Fingers guitar tech Jamie Mechan in Nashville, Tennessee, it began a musical partnership of the highest order. After cranking out a few tunes at Mechan’s fledgling studio, 302 Sound, the duo started recruiting other musicians. The band was rounded out by drummer Ryan Sweeney (Cheap Time) and Eli Steele (Sweet Knives.) Dubbing themselves The Sleeveens, an Irish term for a trickster, the band got to work. After recording and releasing their highly-touted “Give My Regards To The Dancing Girls” 45rpm single on Sweeney’s Sweet Time Records, they finished off their 11 track debut LP. The quartet were soon approached by longrunning punk label Dirtnap Records (Marked Men, Exploding Hearts) for the album’s 2024 release. The resulting LP is an homage to the kind of classic punk Chiswick, New Rose and Stiff Records were releasing 45 years before The Sleeveens existed. With earworm melodies and screaming guitars, the foursome have crafted one of the best albums of the year. Murphy’s penchant for charmingly brilliant, matter-of-fact lyricism has a similar poetic quality as Mark E. Smith or Jonathan Richman. With expert mastering by Jim Diamond (The White Stripes, The Dirtbombs) to put the finishing touches on the sound, The Sleeveens is a record that is simultaneously uncompromisingly raw and thoughtfully crafted.",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=4109219132/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/d7eb9608b93b236cf2cf996aefa00b2f.webp"
    },
    {
      "name": "A Silly Walk",
      "link": "https://www.asillywalk.de/",
      "description": "A Silly Walk (/ə ˈsɪli wɔk/)\n\n(Substantiv, Neutrum)\n\nDefinition von Nischenband. Auch franz. “Une marche stupide”.\n\nGruppe bestehend aus 4 gleichgesinnten Musikanten, die versuchen ein eigenes Genre zu definieren oder aber auch alle Nischen zu bedienen. Hauptsächlich ist es aber eher Punk, Noise und Garage Rock.",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=143617213/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/"
    }
  ],
  "img": "/img/6b0c07c2ec3c60e42d72581791a2fbd7.webp",
  "shopLink": "https://pretix.eu/carousel/sleeveens/"
}
,
  {
  "id": "sgatv_zz",
  "date": "2025-02-21T20:00",
  "title": "S.G.A.T.V. (Schweiz), Zero Zeroes (Karlsruhe) und Dispo (Leipzig)",
  "descriptionShort": "Schweizer Synthpunk Supreme, so oder so ähnlich könnte man S.G.A. T.V. beschreiben. Mit einer Mischung aus Punk- Attitüde und Dungeon Synth werden sie das Autohaus aufreiben und euch gewaltig in den halligen Overdrive fahren! Unterstützung bekommen sie von den Karlsruher Hall Of Fame-Punkern ZeroZeroes! Doch damit nicht genug, wir legen den 6. Gang ein und machen mit den rauchenden Rüpeln der Band DISPO den Hattrick komplett!\n\nDJ Aftershow Party mit Pony Coldhand & John Ass!\n\nPoster art: @exx_valdez",
  "descriptionLong": "",
  "fee": "10",
  "artists": [
    {
      "name": "S.G.A.T.V.",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=3544300794/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/"
    },
    {
      "name": "Zero Zeroes",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=500494345/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/"
    },
    {
      "name": "Dispo",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/0uQTXG10xlY?si=E9WHI-irfGmdOH3x",
      "bandcamp": ""
    }
  ],
  "img": "/img/2718d6f3c4977dafd3b23c2dfd066c42.webp",
  "shopLink": "https://pretix.eu/carousel/sgatv-zz/"
}
,
  {
  "id": "alvilda_loosey",
  "date": "2025-02-28T20:00",
  "title": "Alvilda (Paris) mit Loosey (New York) und Aftershow Party mit Punkrock Aerobix!",
  "descriptionShort": `Ein Freitagabend in Heidelberg, Ende Februar. Karneval? Na klar. Hajo und so. Aber wer noch halbwegs bei Verstand ist, lässt die Pappnase zu Hause und geht ins Carousel, wo zwei Bands spielen, die dich daran erinnern, warum du überhaupt angefangen hast, Musik zu lieben: Alvilda und Loosey.\n\nAlvilda. Vier Pariserinnen, die so cool sind, dass selbst der Eiffelturm neidisch guckt. Ihr Sound? Garage-Rock, wie er klingen muss: roh, direkt, und so ansteckend, dass du mitsingst, bevor der Refrain zum zweiten Mal kommt – oder zumindest „la-la-la“ mit französischem Akzent summst. Ihre EP „Négatif“ hat 2021 den Sommer gerettet. Mehr Energie als jede Konfettibombe!\n\nLoosey. New York City. Eine Stadt, die dich entweder frisst oder dir zeigt, wie du zurückbeißen kannst. Loosey hat gebissen. Inspiriert von UK-Glam, Power-Pop und der ersten Punkwelle liefern sie eine Live-Show so unberechenbar wie ein Kamelle-Wurf. Mit zwei gefeierten EPs und der Zusammenarbeit mit Produzent Matt Sweeney arbeiten sie auf ihr Debütalbum 2025 hin.\n\nUnd als ob das nicht alles schon genug für den letzten Tag im Februar wäre, hat der Goldesel-Elferrat auch noch die wunderbaren Isa Lee Libertine & Angie Action a.k.a. Punkrock Aerobix zur After-Show an die Decks gebeten. \n\nSoweit alles klar?\n\nFlyer: <a href="https://www.instagram.com/joey.controlletti/">@joey.controlletti</a>`,
  "descriptionLong": "",
  "fee": "15",
  "artists": [
    {
      "name": "Alvilda",
      "link": "https://linktr.ee/alvildalp",
      "description": "With their scruffy power pop and contagious freshness, these four Parisians came to attention with their debut EP \"Négatif\", joyfully making us dancing through the summer of 2021. But behind the effortlessly cool façade hide four incredibly hardworking women who have since toured relentlessly, turning their band into a ruthless dancing machine now opening for prestigious acts (The BellRays, The Nomads), before their long-awaited LP comes out in 2024.\n \nAlvilda plays garage rock wonderfully. '60s girl group vocal harmonies backed by a tough punk-y guitar sound with pop flourishes. The songs are so catchy, you start to sing along on the first listen. The French accents lend an extra air of coolness. Their bouncy songs are full of energy and a lot of fun, but also really well executed and sound strikingly authentic like this is some long lost late seventies gem. Alvilda mix ’60s girl group with ’70s Good Vibrations pop punk influences and je t’aime it a lot. It’s insane that these are the first recordings of the band.\nOne smile at a time.",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/0WLX5LRif_4",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=3747921211/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/abf965b00d38efea9883010871ee3d6a.webp"
    },
    {
      "name": "Loosey",
      "link": "https://linktr.ee/looseyband",
      "description": "Loosey play rock’n’roll.  Real, unhinged, beer fueled, sweat soaked, passionate ROCK’N’ROLL. Drawing freely from the traditions of UK Glam and Bovver rock, Australian Hard Rock, classic American Power Pop and first wave Punk, Loosey strive to make rock’n’roll a real, living breathing art form again- free from slick, ironic, industry-plant bullshit and gutless, try-hard, retro-emulation.\nFormed in 2021 in New York City by members of The New York Hounds, Yellow Eyes, and near countless other underground punk and metal bands, Loosey have quickly made a name for themselves with their charismatic and wildly unpredictable live show.  The two highly sought after, self released EPs that followed have only further cemented their reputation for delivering infectious and joyful rock’n’roll like basically no one else can these days.\nAs for what’s next, Loosey has begun work alongside producer Matt Sweeney (Chavez, Zwan, Iggy Pop) on their debut LP for release in 2025, and are planning extensive touring in North America, Europe, and beyond.\nThis is the dawning of LOOSEY.  Get into it.",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=488317698/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/aa55b153592a417642db7d1498aff42c.webp"
    },
    {
      "name": "Punkrock Aerobix",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "",
      "image": "/img/40cd313b9c50c512575376bb296ed49e.webp"
    }
  ],
  "img": "/img/7a9f57a04054097fa457ffa401e7f97a.webp",
  "shopLink": "https://pretix.eu/carousel/alvilda/"
}
,
  {
  "id": "flathead-almostlovers",
  "date": "2025-03-09T15:00",
  "title": "Flathead (Marseille) & Almost Lovers (Brüssel/Lille) - gepflegtes Eskalieren! ",
  "descriptionShort": "Ach, Sie kuscheln Sonntags auch gerne bei Pfefferminztee mit ihrer Katze unter der 15-Tonnen-Gewichtsdecke und überlegen, ob das Leben nicht vielleicht doch anderswo stattfindet? \nNa dann machen Sie es dieses Mal doch einfach wie wir und pfeffern hurtig die Pantoffeln ins Eck’ und checken dann ganz lässig und mit angezogener Handbremse in Heidelbergs schärfstem Autohaus ein (Ifo-Institut approved).\nIm Carousel lesen Ihnen Flathead und Almost Lovers nämlich nicht nur diskret die (musikalischen) Leviten, nein, Sie erwartet auch kanisterweise bittersüßer Messwein und eine Gemeinde, die Ihresgleichen erst noch finden muss. Wer kann da nein sagen? Ja, wir sicher nicht!\nFlathead (Marseille) – predigen eine neue, rauere Version des Powerpop. So, als hätte man noch etwas Dreck vom Samstag unter den Nägeln. In Deutschland wird ihr neues (self-titled) Album am 6. März auf Wanda Records erscheinen. Und dann wird es kein Halten mehr geben. Mit Mitgliedern ehemaliger Punk-Bands wie Tomy & The Cougars, Pogy & Les Kéfars, La Flemme, The Aggravation und Seppuku sind die fünf Jungs bereit für die ganz große Messe.\nAlmost Lovers aus Brüssel – lassen sich von Bands wie Oasis, Teenage Fan Club und The Nerves inspirieren. Die Gitarren immer nach vorn verkörpern unsere Nostalgiker des triumphalen Britpop dieses Erbe und liefern klassisch britischen Rock, der gleichzeitig zeitlos wirkt – perfekt zu ihren Vokuhila-Frisuren und Vintage-Gesangsharmonien. Almost Lovers haben bereits zwei EPs beim französischen Label Howlin' Banana Records veröffentlicht, die jüngste davon im Dezember 2023. Mit Mitgliedern von Ada Oda, Annabel Lee, Departure Kids und Les Concordes bringen sie eine erfrischende Mischung aus Retro-Charme und modernem Sound.\nUnd wenn Sie sich nach dieser wilden Nacht denken: „Uiuiui, was für eine Verwüstung!“, dann machen Sie’s uns nochmal nach und gehen zum Spogomi! Erst feiern, dann Müll sammeln – der Kreislauf des Lebens!\n",
  "descriptionLong": "",
  "fee": "10",
  feeAk: "12",
  "artists": [
    {
      "name": "Flathead",
      "link": "https://linktr.ee/flathead_marseille",
      "description": "With melodies, guitars, passion, and attitude, FLATHEAD is the 70's style rock supergroup of Marseille, France. United under the same powerpop banner since 2020, a first 4 track EP named \"Sunset Girl\" was released on Madrid label Snap!! Records in October 2022. The 5 boys are ready to conquer the world.\n\nWith members of  late punk bands: Tomy & The Cougars, Pogy & Les Kéfars, La Flemme, The Aggravation, Seppuku.\n\n",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/L5jl64KZQf8?si=OWFvl-5aiYrerKki",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=106785986/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/f055ac9958ceb255fd7ef7d09efd118c.webp"
    },
    {
      "name": "Almost Lovers",
      "link": "https://www.instagram.com/almostlovers_band",
      "description": "Almost Lovers revive the spirit of 70s/90s powerpop, like Oasis, Teenage Fan Club and the Nerves as sources of inspiration for their young career. With all guitars forward, these nostalgics of triumphant Britpop assume this heritage by delivering quintessentially English rock, something eternal, which goes with their mullet cuts and vintage vocal harmonies. Almost Lovers have released two EPs on french label Howlin' Banana records, the last one in December 2023.\n\nWith members of Ada Oda, Annabel Lee, Departure Kids, Les Concordes...",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/vKh3yBmOpeg?si=dMOdAZeUwKYsh-7-",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=3505187730/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/8c0c99f1aed8027652f07ce830a9c812.webp"
    }
  ],
  "img": "/img/flathead-almostlovers.jpg",
  "shopLink": "https://pretix.eu/carousel/flamo/"
}
,
  {
  "id": "milk-tv-lemongrab-warm-swords",
  "date": "2025-04-04T20:00",
  "title": "Milk TV (Brüssel), Lemongrab (Berlin) und Warm Swords (Leipzig)",
  "descriptionShort": "Es ist April und der Heidelberger Frühling™ ist in vollem Gange! Doch die Hauptstraß' ist uns zu glatt, wir geben Vollgas auf dem Seitenstreifen mit einem Dreierpack Art-Punk, der dir härter ins Hirn fährt, als jeder Frühjahrsheuschnupfen.\n\nMit dabei sind Milk TV aus der Europastadt Brüssel! Mit Postironie und VHS-Nostalgie und einer Prise Devo, XTC und Sparks, ist man hier auch ohne Antihistamine gewappnet und verlangt nach mehr!\nDie Berlin-Kanadische Kooperation von Lemongrab packen ihre Koffer und bringen sehr viel Post-Punk, etwas Grunge und eine energiegeladene Live Show ins Carousel mit Und nicht nur das, denn die Neuseeland-Frazösisch-Leipziger Truppe Warm Swords passen auch noch ins Gepäck um die Post-Punk Nummer noch einmal auf Links zu drehen, etwas Egg hinzuzufügen und uns mit ordentlich Fahrvergnügen im Kreis drehen wird!\n\nZum krönenden Abschluss gibt es noch ein gehörige Portion Funk-Grooves direkt von der Rille von Hard Boiled Funk auf die Ohren, um das Omelette komplett zu machen!\nArtwork: <a href=\"https://www.instagram.com/the_prints_of_persia/\" target=\"blank\">Prints of Persia</a>",
  "descriptionLong": "",
  "fee": "12",
  "feeAk": "15",
  "artists": [
    {
      "name": "Milk TV",
      "link": "https://www.instagram.com/milk.tv.band/",
      "description": "Milk TV is an \"Art Punk\" trio created in 2017 in Brussels. He draws on playground nostalgia, cheap TV and a healthy dose of post-Reagan cynicism to produce choppy, raucous rock music that makes it sound like Devo, Wire, Xtc and...Primus aren't too far in the rearview mirror.\nWith members of Ropoporose, Brorlab, Phoenician Drive.",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/715KwpRYz3g?si=rZ7Cp456JKBTqbrL",
      "bandcamp": "",
      "image": "/img/c56f6b45edd465a790e08441e36ab10e.webp"
    },
    {
      "name": "Lemongrab",
      "link": "https://www.instagram.com/lemongrammm/",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=720573584/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true",
      "image": "/img/3cfba27a95b4671b9e6503c2f97e4dae.webp"
    },
    {
      "name": "Warm Swords",
      "link": "https://www.instagram.com/warm.swords/",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=3864379952/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true",
      "image": "/img/fda19647b39a3a12a4553bb2ab12c038.webp"
    }
  ],
  "img": "/img/06dc84a56bce0873820c1b1eb03871e3.webp",
  "shopLink": "https://pretix.eu/carousel/milk-tv-lemongrab-warm-swords/"
}
,
  {
  "id": "snapped-ankles-fatale",
  "date": "2025-04-15T19:00",
  "title": "Snapped Ankles (London), Fatale (Heidelberg)",
  "descriptionShort": "Metropolink‘s Commissary & Autohaus are joining forces for the first time and we are thrilled to present Snapped Ankles from the UK – they will blow the leaves right off your treetops!\n\nHeidelberg's Fatale are on support duties and will hit the first axe into the trunk!\n\nDon‘t miss out.\n\nArtwork by <a href=\"https://www.instagram.com/julian.grmn/\" target=\"self\">@julian.grmn</a>",
  "descriptionLong": "",
  "fee": "19,47",
  "feeAk": "20",
  "artists": [
    {
      "name": "Snapped Ankles",
      "link": "https://www.instagram.com/snappedankles/",
      "description": "They came from the trees.\n\nNow settled in fertile east London, Snapped Ankles maintain the feral energy of the forest. Fight or flight. Primal motorik rhythms, the rush of white noise and synth-punk angles; an aural onslaught played out on homemade log synths, electrified guitars and sticks beating hell on taut animal skin.\n\nSnapped Ankles have flourished in the sub-tropical climes of warehouse and squat parties, moving onto performance art collaborations with filmmakers and shows in unlikely locations such as barber shops, games arcades and the forests they once called home. They plough a singular furrow at improbable angles. The woodwose have discovered electricity and they’re not afraid to use it.",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/MVbkkyCw66w?si=7zFok4ikcrX4-_S-",
      "bandcamp": "",
      "image": "/img/snapped_ankles.jpg"
    },
    {
      "name": "Fatale",
      "link": "https://www.instagram.com/fatale_hd/",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "",
      "image": ""
    }
  ],
  "img": "/img/snapped_ankles_flyer.jpg",
  "shopLink": "https://rausgegangen.de/en/events/snapped-ankles-hard-times-furious-dancing-tour-0/"
}
,
  {
  "id": "wax-head-zuendung",
  "date": "2025-04-26T20:00",
  "title": "Wax Head (Manchester, UK) und Zündung (Heidelberg)",
  "descriptionShort": "EIN ABEND FÜR DEN NACKTMULL\n\nHöchste Zeit, sich mal näher mit dem Nacktmull zu befassen – dieser Ikone der biologischen Gegenkultur. Am 26. April laden wir deshalb Wax Head (UK) und Zündung (HD) als ausgewiesene Experten auf dem Gebiet der Tunnel-Forschung ins Carousel ein. Forscherinnen und Entdecker aufgepasst – das wird ein unterirdisch guter Abend!\nEben noch mit den Wartungsarbeiten am tropfenden Eurostar-Tunnel beauftragt, haben  Wax Head aus Manchester mal ganz locker nebenbei ihre neueste Single „Terminal Sinker“ über Sour Grapes Records an die Oberfläche gepusht. Ein Sound, der uns alle schaufeln lässt – Repeat-Taste gedrückt, und Oma Ernas Gemüsebeet ist ruckzuck auf links gedreht. Aktuelle #1 der Nacktmull-Playlist.\nUnd wenn’s im sogenannten Heidelberger Untergrund mal wieder was zu sprengen gibt, sind Zündung natürlich ganz vorne mit dabei – die Lunte so kurz wie ihre Gitarrenriffs. Bei ihrer Show tauchst du garantiert nur zum Luftschnappen auf. Nacktmull-certified!",
  "descriptionLong": "",
  "fee": "10",
  "feeAk": "12",
  "artists": [
    {
      "name": "Wax Head",
      "link": "https://www.instagram.com/waxhead.band/",
      "description": "",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/NQrvD_YKE3Q?si=X8s5m3Qlup8uel8c",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=2395743865/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/b8955052aa9608f1fa4ffb03aa3b2f9a.webp"
    },
    {
      "name": "Zündung",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/INcHWWMnMBg?si=e2iXpB4CAxlPmEH_",
      "bandcamp": ""
    }
  ],
  "img": "/img/bf010160c648bc7114f1332c2879389c.webp",
  "shopLink": "https://pretix.eu/carousel/wax-head-zuendung/"
}
,
  {
  "id": "condor-chemical-threat",
  "date": "2025-05-06T19:00",
  "title": "Condor (Oi! aus Frankreich) und Chemical Threat (Rhineline Hardcore)",
  "descriptionShort": "Okay, okay, wir legen nochmal nach und starten mit einem Oberhammer in den Mai. Condor um Max Smadja von Rixe fegen an diesem Dienstagabend bei ihrem einzigen Tourstopp in Westdeutschland einmal über die Bühne des Carousel. Smadja hat die Stücke auf den beiden Cassingles (oder gesammelt als Singles auf Beach Impediment) zwar alleine eingehämmert, wird auf der Tour allerdings u.a. von Mitgliedern der Savageheads unterstützt. 80er Punk mit deutlichem Oi-Einschlag und sehr hohe Drehzahl werden serviert.\nDynamik und Spannungsbogen haben wir für diesen Termin ignoriert und fangen gleich mit Hardcore Punk Geschmacksrichtung hart und schnell an: Chemical Threat von STTW Records bringen den Rhineline Hardcore an den Neckar.",
  "descriptionLong": "",
  "fee": "10",
  "feeAk": "12",
  "artists": [
    {
      "name": "Condor",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=1256621441/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true"
    },
    {
      "name": "Chemical Threat",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=461990999/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true"
    }
  ],
  "img": "/img/29fd96a9138d131d041ef227d7248874.webp",
  "shopLink": "https://pretix.eu/carousel/condor-chemical-threat/"
}
,
  {
  "id": "mitraille-neat-mentals-muddux",
  "date": "2025-05-30T20:00",
  "title": "Mitraille (Garage Punk, Antwerpen), Neat Mentals (Punk Rock, Stuttgart) und MudDux (Autohaus)",
  "descriptionShort": "Am 1. Tag nach Christi Himmelfahrt ist im Carousel die Hölle los! Eine heilige Dreifaltigkeit des Punk Rock bringt euch zum Tanzen, als wäre der Boden aus Lava. Denn aus Antwerpen, über gut ausgeleuchtete Autobahnen direkt nach Heidelberg ins Autohaus, fahren Mitraille ihren nervösen Garage Punk vor, bis ihr euch vor Power Pop Hooks und Garage-Hymnen nicht mehr retten könnt! Auch davor gibt es Punk Rock ohne Geschwindigkeitsbegrenzung aus Stuttgart mit den Neat Mentals. Das Ganze wird von MudDux eröffnet. Zu einem Drittel Mexikanisch, einem Drittel Irisch und einem Drittel Yankee sind die Inhouse Punx musikalisch dem Punkrock der 90er nicht fremd. Also packt eure Matschhosen ein und kommt am 30. Mai zur Punkrock Prozession ins Autohaus gedriftet!",
  "descriptionLong": "",
  "fee": "10",
  "feeAk": "12",
  "artists": [
    {
      "name": "Mitraille",
      "link": "https://www.instagram.com/mitrailleband/",
      "description": "",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/7aiO9kCkAEY?si=uN0DsC2nsV2Tc2Eo",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=1855328498/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/7d13e58571ad5f5d2de4899b5b0fad75.webp"
    },
    {
      "name": "Neat Mentals",
      "link": "https://www.instagram.com/neatmentals/",
      "description": "",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/_uVplWgB6zc",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=3857505738/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true"
    },
    {
      "name": "MudDux",
      "link": "",
      "description": "Up the Autohaus Punx!",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": "",
      "image": "/img/muddux.jpg"
    }
  ],
  "img": "/img/50c5776d2823ff60a38670d8363259dc.webp",
  "shopLink": "https://pretix.eu/carousel/mitraille-neat-mentals-muddux/"
}
,
  {
  "id": "dccross",
  "date": "2025-06-12T19:00",
  "title": "Rückwärts in den Sonnenuntergang – D.C Cross (AUS) & The Long Strange Trip (Autohaus)",
  "descriptionShort": "Aus Australien kommt einer zu uns, der Gitarre spielt und klingt wie ein UFO-Absturz im Outback: D.C Cross. Mit seiner „Ecstatic Guitar“ streunt er irgendwo zwischen John Fahey, Elizabeth Cotten und Nick Drake umher. Der Mensch kann natürlich auch Fahrrad fahren, rückwärts versteht sich, wie in seinem neuesten Video „International Bury the Hatchet Day“ beneidenswert zu bestaunen ist. \nAll das hat er auf sein neuestes Album „Glookies Guit“ gepresst. Ein Vinyl gewordener, ungewöhnlich wohltuender Sonnenstich! \nBevor Cross sich durchs Raum-Zeit-Kontinuum zupft, gibt es warmen Asphalt mit The Long Strange Trip. Musik wie ein rostiger Chevy vor der Bowlingbahn. Wir sehen uns bei ner kalten Coke an der Bar vom Carousel.",
  "descriptionLong": "",
  "fee": "frei / 0€",
  "artists": [
    {
      "name": "D.C Cross",
      "link": "https://www.instagram.com/d.ccross/",
      "description": "Darren D.C Cross is an instrumental ecstatic guitarist.\n\nIn the tradition of Leo Kottke, John Fahey, Nick Drake, Elizabeth Cotton and Mississipi John Hurt but forging a unique Australian perspective on the genre. Open guitar tunings to conjure light and shade and bring the spirit.",
      "soundcloud": "",
      "youtube": "https://www.youtube.com/embed/RoHUsuQtj_c",
      "bandcamp": "https://bandcamp.com/EmbeddedPlayer/album=3020950765/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/",
      "image": "/img/310c924c76c4c891023276357d898dd2.webp"
    },
    {
      "name": "The Long Strange Trip",
      "link": "",
      "description": "",
      "soundcloud": "",
      "youtube": "",
      "bandcamp": ""
    }
  ],
  "img": "/img/7e82dd96fa8658bd0a0cf514ce2c04c5.webp"
}
]