export type Event = {
    // Unique id, this is used in the URL so URLencoded is better
    id: string,
    date: string,
    title: string,
    // path to image
    img?: string,
    descriptionShort: string,
    descriptionLong?: string,
    fee: string,
    artists: Array<{
        name: string,
        image?: string,
        link?: string,
        description?: string,
        soundcloud?: string,
        youtube?: string,
        bandcamp?: string
    }>
};

export const events: Event[] = [
    {
        id: 'carouslam-1-05-16-2024',
        date: '2024-05-16T20:00:00',
        title: 'CarouSlam I: Busted Head Racket 🥊 Socke',
        fee: "10€, Kombi-Preis mit CarouSlam II: 15€",
        descriptionShort: "Am 16. und am 17. Mai lädt euch der Goldesel zum CarouSlam '24 ins Autohaus ein!\n\n Los geht es am 16. Mai mit Teil eins: auf der einen Seite stehen Busted Head Racket, feinster eggy Synth Punk aus Australien, welche vor drei Wochen bei Erste Theke Tonträger (aus Mannheim mit dem Spezialgebiet: arschgeile Mucke) ihr Album Go Go Go! veröffentlichten und nun auf Europatournee auch bei uns auf die Matte bringen werden. Finishing Move: Pitch Wheel Drop. \n\n Auf der anderen Ringseite warten die wenig kuscheligen Heidelberger Socke mit P-P-P-Punk um euch links zu drehen! Finishing Move: Axe Africa Bomber.",
        artists: [
            {
                name: 'Busted Head Racket',
                link: "https://bustedheadracket.bandcamp.com/",
                description: "Originally starting out as a solo bedroom project for bassist-vocalist Arden Guff, Busted Head Racket, have been one of leading bands in the current Newcastle punk scene. Their radiant energy of unrestrained and hyper-accelerated synth-punk recently earned them an opening spot for rising Nashville punks Snõõper. Following up last year's split tape with weirdo German punk Teo Wise, the trio that now includes Guff, keyboardist Dave Cunningham, and drummer Riley Gardiner, have a new 8-track EP out today called Junk Food.",
                youtube: "https://www.youtube.com/embed/Eu6Qv_ySFgo?si=cGZX-9ECsip4VDQZ",
                soundcloud: "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1376989297&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true"
            },
            {
                name: 'Socke',
                description: "Legendäre Heidelberger Punk Band, muss man nicht viel zu sagen.",
            }
        ]
    },


    {
        id: 'carouslam-2-05-17-2024',
        date: '2024-05-17T20:00:00',
        title: 'CarouSlam II: The Whiffs 🥊 City Boys',
        fee: "10€, Kombi-Preis mit CarouSlam I: 15€",

        descriptionShort: "CarouSlam Runde zwei startet am 17. Mai ab 20:00 im Autohaus! \n\n Die Herausforderer in der einen Ringecke kommen aus Kansas City, beherrschen Power Pop in so gut wie allen Facetten in Perfektion: The Whiffs! Letztes Jahr erschien Scratch ‘N’ Sniff, das bereits dritte Werk, gespickt mit einem Hit nach dem anderen, auf Dig! Records (bzw. in Europa auf dem legendären Label Bachelor Records) und knüpft nahtlos an die vorangegangenen Veröffentlichungen Take A Whiff und Another Whiff. Finishing Move: Double Knee Heartbreaker. \n\nDie Gastgeber in der anderen Ecke kennen jeden Quadratzentimeter des Carousels und versuchen mit Croonern im ¾ Takt über Bullet Dancing Western Nummern bis zu schnellen Pub Rockern den Gästen aus Missouri Paroli zu bieten. Die Hinrunde vor zwei Jahren in der Villa Nachttanz ging jedenfalls ordentlich in die Magengrube! Finishing Move: C# Shooter.Wer wird den Gürtel am Ende umschnallen? Kommt rum und findet es raus!",
        artists: [
            {
                name: 'The Whiffs',
                description: "This album just feels like America. It transports me to some mythical dive bar where The Replacements, Tom Petty, and Cheap Trick still rule the jukebox. — Faster And Louder",
                youtube: "https://www.youtube.com/embed/6dM2rAb-RL8",
                link: "https://www.thewhiffsband.com/"
            },
            {
                name: 'City Boys',
                link: 'https://city-boys.bandcamp.com/',
                description: "Auf Gleis 7 schaufeln die City Boys ordentlich Kohlen in den Kessel des Country-Schrammelpop-Zugs auf dem Weg von Heidelberg nach Shelbyville. Toot-toot, bei 90/mph wollen alle sofort einen Line Dance aufs Parkett vom Bordbistro legen. Gitarre, Schlagzeug und Bass schlingern roadrunnermäßig um die 3/4 Akkord-Kurve. Jetzt erstmal einen Stopp bei Tank & Rast.",
                youtube: 'https://www.youtube.com/embed/hpMjJ-4r-iM'
            }
        ]
    },



    {
        id: 'forest-ray-28-05-2024',
        date: '2024-05-28T20:00:00',
        title: 'Forest Ray ❤️ The Roaring 420s',
        fee: "Spendenbasis",
        img: "/img/forest_ray.jpg",
        descriptionShort: `Auch in diesem Jahr möchte der Goldesel wieder einen Beitrag zum Deutsch-Amerikanischen Freundschaftsfest leisten. Im Autohaus kurbeln wir daher am 28. Mai um 20 Uhr sämtliche Seitenscheiben runter, hängen das linke Bein zum Fenster raus (Automatik!), stellen die Lauscher auf und das Autoradio auf 98,7. Wolfman Jack heult los und kündigt Forest Ray zur Live-Session an.

        Die Psych-Rocker Kombo aus Seattle startet mit Please Be Nice To Me ihren V8 auf Benzos. Sämtliche Kofferraumdeckel  fangen an zu wummern, die B-Bender sorgen für angenehme Kurvenlage! Kräftiger Kickdown im Anflug, aber keinem verrutscht an diesem Abend das Bier auf der Rückbank. Doch was wäre so ein staubiger Roadtrip ohne Companion? Genau, nur ein Ghost on a Highway. Über die Route B96 kommen zum Glück die Roaring 420s aus Dresden zur Rettung!
        
        Und hinterher trinken alle noch 2 Bourbon Whisky im Soft Rock Cafe.`,
        artists: [
            {
                name: 'Forest Ray',
                description: "Forest Ray is a psychedelic rock project whose dedication to analog recording has harbored a darker, older and more intimate sound. Forest Ray's music combines guitar driven psychedelic rock with tinges of raw synth-laced post-punk, Tropicalia flute and uninhibited performances that embody the garage punk aesthetic that fueled the group's creation ",
                youtube: "https://www.youtube.com/embed/I6estL4fqvI",
                link: "https://forestray.bandcamp.com/"
            },
            {
                name: 'The Roaring 420s',
                link: "https://theroaring420s.bandcamp.com/album/the-roaring-420s",
                description: "Blending surf rock and late 60s pre-Punk into Eastern psychedelia The Roaring 420s from Dresden, Germany, rather sound like an obscure little gem discovered at a garage sale in California. Roughly located somewhere between The Beach Boys and The Velvet Underground, they’re bursting out with twangy guitars, groovin' organ and an electric sitar! ",
                youtube: 'https://www.youtube.com/embed/-psBFcQ8t-k'
            }
        ]
    },


    {
        id: 'hdf-31-05-2024',
        date: '2024-05-31T19:00:00',
        title: 'Hodi Flow Hodilicious Release Party',
        fee: "Spendenbasis",
        img: "/img/hodi_flow.jpg",
        descriptionShort: `Hallo Freunde der Sonne. Am 31.05.2024 findet die "Hodilicious" Release Party im Carousel statt. Hodi Flow und DJ Soundtrax aus Köln präsentieren das neue Album mit satten Hip Hop Beats und Lyrics, die ihresgleichen suchen. Special Acts aus der Region werden ebenfalls am Start sein und die Hütte zum Beben bringen. Kommt vorbei! Ihr werdet es nicht bereuen 😉`,
        artists: [
            {
                name: 'Hodi Flow',
                description: "Das lang ersehnte Album, 'Hodilicious', von Hodi Flow in Zusammenarbeit mit DJ Soundtrax hat nun den Weg ans Tageslicht gefunden. Mit satten HipHop Beats und Lyrics, die seinesgleichen suchen, wird Heidelbergs Hip Hop erneut auf die Bildfläche projiziert und zeigt sich hierbei von seiner besten Seite. Neben der Möglichkeit die Lieder auf Musik-Streaming Plattformen zu hören, können Hörer das Album nun auch als Vinyl oder Kassette erwerben.",
                youtube: "https://www.youtube.com/embed/8hAQjFlv7jU",
                link: "https://breakinallrecords.bandcamp.com/album/hodilicious"
            }
        ]
    },
    {
        id: 'sommer-2024',
        date: '2024-06-22T16:00:00',
        title: 'Carousel Sommerfest',
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
                name: 'Beach Towel',
                youtube: `https://youtube.com/embed/hQjNV-fDMaU`
            },
            {
                name: 'Novitchok',
                youtube: 'https://youtube.com/embed/ZtvqZdkan9g'
            },
            {
                name: 'Bonfire Orchestra',
                youtube: "https://youtube.com/embed/QSVKgdivYac"
            },
            {
                name: 'Jimson Drift',
                youtube: "https://youtube.com/embed/7jkGz_NHcT8"
            },
            {
                name: 'Rico Banton',
                youtube: "https://youtube.com/embed/Sye9lUPlqnY"
            },
            {
                name: 'Glider',
                youtube: "https://youtube.com/embed/Gb9YfYRh-KQ"
            }
        ]
    },
    {
        id: 'loons-mustang-fang',
        date: '2024-07-11T20:00:00',
        title: 'The Loons (Psychedelic Garage Beat aus San Diego, Kalifornien) mit Mustang Fang (Karlsruhe)',
        fee: "",
        img: "/img/loons.png",
        descriptionShort: `Sixties Garage Sound, als käme er direkt von einer der legendären Nuggets Compilations zur amerikanischen Psychedelic Welle ab Mitte der Sechziger Jahre ist das, wozu der Goldesel euch am 11. Juli ins Carousel im Autohaus einlädt! The Loons drehen sich um Mike Stax (zuvor bei The Crawdaddys und The Tell-Tale Hearts und Herausgeber von Ugly Things Magazine), wurden 1997 gegründet, veröffentlichten seitdem fünf Alben auf den einschlägigen Labels wie BOMP! und Get Hip Recordings und touren nun mit dem neuesten Werk “Memories Have Faces” (Munster Records), um euch die buchstäblichen Faces mit ihrem Fuzz-durchtränkten Sound zu melten!

Bevor wir uns in den Sechzigern wähnen, gibt es eine Dosis Country-Glitch-Hop von Mustang Fang auf die Lauscher.`,
        artists: [
            {
                name: 'The Loons',
                youtube: `https://youtube.com/embed/YnDbOZXJ0ro`
            },
            {
                name: 'Mustang Fang',
                youtube: 'https://youtube.com/embed/N_2srIvBDI8'
            }
        ]
    },
    {
        id: 'wurst-durst',
        date: '2024-07-14T14:00:00',
        title: 'Wurst & Durst',
        fee: "",
        img: "/img/wurst_durst.jpg",
        descriptionShort: `Flanell Aktuell schmeißen den Grill an und ihr könnt bisschen die Ateliers anschauen, snacken, trinken…auf gemütlich!

Gerne auch eigenes Grillgut mitbringen, wenn ihr großen Hunger habt :)

14:00-18:00 Uhr
 `,
        artists: []
    },
    {
        id: 'dgf_wild-mustang',
        date: '2024-07-27T20:00:00',
        title: 'Die Groben Fetten / Wild Mustang',
        fee: "",
        img: "/img/dgf_wild_mustang.jpg",
        descriptionShort: `DIE GROBEN FETTEN sind DER Headliner des Lametta & Wurst Festivals, welches es aber aus uns unerfindlichen Gründen noch immer (2024!) nicht gibt. Aus einem schimmligen Würzburger Keller haben sie es in nur 10 Jahren erstaunlich schnell und stilsicher ans Tageslicht geschafft und leben irgendwo zwischen Rügenwald und Ostpommern ein Leben auf der Überholspur. Fettige Ohrwürmer, Synthi und Nasenflöte, sowie ein ordentliches Pfund gehackte Anarcho-Performance, versprechen einen Abend, an dem auch mal mitgesungen werden darf. 

Auf dem Rücken des WILD MUSTANG galoppieren wir durch lo-fi Countryland in den Sunset vom Autohaus. Bittersweete Melodien sind sein Leben und trotz staubigster Prärie: hier bleibt garantiert kein Auge trocken!   `,
        artists: [
            {
                name: 'Die Groben Fetten',
                youtube: `https://www.youtube.com/embed/XBFSX3olM1Y`
            },
            {
                name: 'Wild Mustang',
                youtube: 'https://www.youtube.com/embed/izYhyltt9fU'
            }
        ]
    },
    {
        id: 'cool-sorcery',
        date: '2024-09-11T19:00:00',
        title: 'Cool Sorcery (Brasilien)',
        fee: "10€",
        img: "/img/cool sorcery, zyph.jpg",
        descriptionShort: `Synth Punk's not dead! Jedenfalls nicht wenn es nach uns und Cool Sorcery geht. Und nein, die sind nicht aus Down Under sondern aus Brasilien, oha! Während die Alben weitestgehend alleine von Marcos Assis geschrieben, eingespielt, aufgenommen, gemischt und gemastered sind, muss er auf der Bühne nicht einen auf Hyper One-Man-Band machen, sondern spielt mit kompletter Band auf. Das neue Album heißt Terra Invaders, beinhaltet zahlreiche Features, handelt von uns überlegenen Aliens und ist eine spannende Mischung aus eggy Punk und Psych Jams.

Uns aus der Sommerpause holen werden uns Zyph aus Mannheim, freshe Band, reißender Punk auf Deutsch. Pogo Kompatibilität 10/10.`,
        artists: [
            {
                name: 'Cool Sorcery',
                link: 'https://distrokid.com/hyperfollow/coolsorcery/terra-invaders',
                bandcamp: `https://bandcamp.com/EmbeddedPlayer/album=3272968982/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/`,
                youtube: 'https://www.youtube.com/embed/1P3v6h1gZoc'
            },
            {
                name: 'Zyph',
                bandcamp: 'https://bandcamp.com/EmbeddedPlayer/album=2131561424/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/'
            }
        ]
    }

]