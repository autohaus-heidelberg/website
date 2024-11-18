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
    date: "2024-12-06T21:00:00",
    title: "Yggdrasil",
    img: "/img/yggdrasil.jpg",
    descriptionShort: `Lebe im Jetzt, warte nicht auf morgen;
      pflücke heute die Rosen des Lebens.
      Original: Lev i nuet, vent ikke til i morgen;
      plakk livets roser i dag.

      Es wird wieder Zeit, dass sich die Tore öffnen!

      Wir werden leider auch nicht jünger, aber wollen auf mindestens ein größeres Stampfen nicht verzichten.

      Es wird kalt, und wir laden euch ein, in unsere kleine neue Höhle zu kommen. Es wird kuschelig, es wird warmen Glühwein und Met geben. Draußen wird eine kleine gemütliche Oase für euch gestaltet.

      Auftakt ist am 6. Dezember 2024 um 21 Uhr. Kommt pünktlich, denn in der Höhle haben nur 199 Wikinger/innen Platz. Der Eintritt kostet 10 Euro und wird an den Carousel e.V. gehen.**

      Eine Einladung

      Bringt eure Liebsten mit!  
      Bringt euch ein und schreibt uns, wenn ihr helfen möchtet. Wir brauchen immer Unterstützung.  
      Weitere Infos gibt es in unserer Telegram-Gruppe.  
      Infogruppe: <a href=https://t.me/+b1XeoUnQC6A2MDBi>https://t.me/+b1XeoUnQC6A2MDBi</a>

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
];
