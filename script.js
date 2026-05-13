const SAVE_KEY = "myoho_quest_split_save_v4";
const PLAYER_MAX_HP = 100;
const REVIEW_ENEMY_HP = 40;
const CORRECT_DAMAGE = 20;
const WRONG_DAMAGE = 15;

const SAFE_AREAS = typeof AREAS !== "undefined" && Array.isArray(AREAS) ? AREAS : [];
const SAFE_QUESTIONS = typeof QUESTIONS !== "undefined" && Array.isArray(QUESTIONS) ? QUESTIONS : [];
const SAFE_CLOVERBIRD_LINES = typeof CLOVERBIRD_LINES !== "undefined" && CLOVERBIRD_LINES ? CLOVERBIRD_LINES : {};
const SAFE_TITLE_RULES = typeof TITLE_RULES !== "undefined" && Array.isArray(TITLE_RULES) ? TITLE_RULES : [];
const SAFE_STORY_TEXTS = typeof STORY_TEXTS !== "undefined" && STORY_TEXTS ? STORY_TEXTS : {};
const SAFE_BATTLE_WORDS = typeof BATTLE_WORDS !== "undefined" && BATTLE_WORDS ? BATTLE_WORDS : {};
const SAFE_CHARACTERS = typeof CHARACTERS !== "undefined" && CHARACTERS ? CHARACTERS : {};

let app = null;
let state = defaultState();
let battle = null;
let pendingFinalAreaId = null;

function initGame() {
  app = document.getElementById("app");

  if (!app) {
    alert("ゲーム画面の読み込みに失敗しました。index.html に <div id=\"app\"></div> があるか確認してください。");
    return;
  }

  loadGame();
  showTitle();
}

function defaultState() {
  return {
    playerName: getDefaultHeroName(),
    clearedAreas: [],
    totalAnswers: 0,
    totalCorrect: 0,
    wrongQuestionIds: []
  };
}

function loadGame() {
  try {
    const rawData = localStorage.getItem(SAVE_KEY);

    if (!rawData) {
      state = defaultState();
      return;
    }

    const loaded = JSON.parse(rawData);

    state = {
      playerName: sanitizePlayerName(loaded.playerName || getDefaultHeroName()),
      clearedAreas: Array.isArray(loaded.clearedAreas) ? loaded.clearedAreas : [],
      totalAnswers: Number(loaded.totalAnswers) || 0,
      totalCorrect: Number(loaded.totalCorrect) || 0,
      wrongQuestionIds: Array.isArray(loaded.wrongQuestionIds) ? loaded.wrongQuestionIds : []
    };
  } catch (error) {
    state = defaultState();
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (error) {
    console.log("保存できませんでした。", error);
  }
}

function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (error) {
    return false;
  }
}

function resetGame() {
  const ok = confirm("保存データを消して、はじめから遊びますか？");
  if (!ok) return;

  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.log("保存データの削除に失敗しました。", error);
  }

  state = defaultState();
  battle = null;
  pendingFinalAreaId = null;
  showNameInput();
}

function showTitle() {
  loadGame();

  app.innerHTML = `
    <div class="screen">
      <div class="title-box">
        <div class="title-inner">
          <div class="crest">🍀</div>
          <h1>ミョウホウ・クエスト</h1>
          <p class="subtitle">希望の教学と第六天の魔王</p>
          <p class="small">スマホ向け・教学クイズRPG</p>
        </div>
      </div>

      <div class="box command-window">
        <h2>迷いを晴らす冒険へ</h2>
        <p>相棒クローバードとともに、教学という「人を立たせる武器」を鍛えよう。</p>
        <p>各地のまよいモンスターを倒し、最後はマヨイの塔にひそむ第六天の魔王へ挑みます。</p>
      </div>

      <div class="box">
        <h3>冒険者</h3>
        <p><strong>${escapeHtml(getPlayerName())}</strong></p>
        <span class="tag">${escapeHtml(getTitleName())}</span>
      </div>

      <div class="btn-area">
        <button onclick="showNameInput()">はじめる</button>
        <button class="sub" onclick="continueGame()">つづきから</button>
        <button class="sub" onclick="showStats()">成績を見る</button>
        <button class="danger" onclick="resetGame()">はじめから</button>
      </div>
    </div>
  `;
}

function showNameInput() {
  const defaultName = getPlayerName();

  const nameIntro = Array.isArray(SAFE_STORY_TEXTS.nameIntro) && SAFE_STORY_TEXTS.nameIntro.length
    ? SAFE_STORY_TEXTS.nameIntro
    : ["旅立つ前に、君の名を刻め。", "この名前は、迷いに立ち向かう冒険者の名になる。"];

  let introHtml = "";
  nameIntro.forEach(function(text) {
    introHtml += `<p>${escapeHtml(text)}</p>`;
  });

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>名前入力</strong>
        <button onclick="showTitle()">戻る</button>
      </div>

      <div class="box command-window">
        <h2>${escapeHtml(getBattleWord("nameInputTitle", "冒険者の名を刻め"))}</h2>
        ${introHtml}
      </div>

      <div class="box">
        <div class="name-preview">
          ${renderSprite({
            type: "hero",
            spriteClass: getHeroSpriteClass(),
            spritePath: getHeroSpritePath(),
            fallbackMark: getHeroFallbackMark()
          })}
          ${renderSprite({
            type: "buddy",
            spriteClass: getCloverbirdSpriteClass(),
            spritePath: getCloverbirdSpritePath(),
            fallbackMark: getCloverbirdFallbackMark()
          })}
        </div>

        <div class="name-form">
          <label class="name-label" for="playerNameInput">主人公の名前</label>
          <input
            id="playerNameInput"
            class="name-input"
            type="text"
            value="${escapeAttr(defaultName)}"
            maxlength="10"
            placeholder="${escapeAttr(getDefaultHeroName())}"
            autocomplete="off"
          >
        </div>
      </div>

      <div class="btn-area">
        <button onclick="savePlayerNameAndStart()">${escapeHtml(getBattleWord("nameInputButton", "この名前で旅立つ"))}</button>
        <button class="sub" onclick="startWithDefaultName()">${escapeHtml(getBattleWord("defaultNameButton", "ユウキで始める"))}</button>
      </div>
    </div>
  `;

  setTimeout(function() {
    const input = document.getElementById("playerNameInput");
    if (input) {
      input.focus();
      input.select();
    }
  }, 50);
}

function savePlayerNameAndStart() {
  const input = document.getElementById("playerNameInput");
  const value = input ? input.value : "";
  state.playerName = sanitizePlayerName(value);
  saveGame();
  showPrologue();
}

function startWithDefaultName() {
  state.playerName = getDefaultHeroName();
  saveGame();
  showPrologue();
}

function continueGame() {
  loadGame();

  if (hasSave()) {
    showAreaSelect();
  } else {
    showNameInput();
  }
}

function showPrologue() {
  const prologue = Array.isArray(SAFE_STORY_TEXTS.prologue) && SAFE_STORY_TEXTS.prologue.length
    ? SAFE_STORY_TEXTS.prologue
    : [
        "世界に、静かな“迷い”が広がっていた。",
        "その声を広げているのは、人のあきらめを力に変える存在――第六天の魔王。",
        "主人公は、旅の途中で一羽の相棒と出会う。名はクローバード。",
        "クローバードは低く言った。「教学は、飾りじゃない。人を立たせるための武器だ。」",
        "こうして主人公は、教学という希望の武器を身につけるため、クローバードとともに旅立つ。"
      ];

  let storyHtml = "";
  prologue.forEach(function(text) {
    storyHtml += `<p>${escapeHtml(applyStoryName(text))}</p>`;
  });

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>プロローグ</strong>
        <button onclick="showTitle()">戻る</button>
      </div>

      <div class="box command-window">
        <h2>${escapeHtml(getPlayerName())}の旅立ち</h2>
        ${storyHtml}
      </div>

      <div class="btn-area">
        <button onclick="showAreaSelect()">冒険へ出発</button>
        <button class="sub" onclick="showTitle()">タイトルへ</button>
      </div>
    </div>
  `;
}

function showAreaSelect() {
  loadGame();

  if (!SAFE_AREAS.length) {
    app.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <strong>エラー</strong>
          <button onclick="showTitle()">戻る</button>
        </div>
        <div class="box">
          <h2>エリアデータがありません</h2>
          <p>data.js の AREAS を確認してください。</p>
        </div>
      </div>
    `;
    return;
  }

  const finalUnlocked = isFinalAreaUnlocked();
  let areaButtons = "";

  SAFE_AREAS.forEach(function(area) {
    const cleared = state.clearedAreas.includes(area.id);
    const locked = area.final && !finalUnlocked;

    areaButtons += `
      <button
        class="area-button ${cleared ? "clear" : ""} ${locked ? "locked" : ""}"
        ${locked ? "disabled" : ""}
        onclick="${area.final ? `showBeforeFinal('${escapeAttr(area.id)}')` : `startBattle('${escapeAttr(area.id)}')`}"
      >
        <span class="area-title">${cleared ? "✅ " : ""}${escapeHtml(area.name)}</span>
        <span class="area-meta">テーマ：${escapeHtml(area.theme)}</span>
        <span class="area-meta">ボス：${escapeHtml(area.boss)}</span>
        <span class="area-meta">迷い：${escapeHtml(area.doubt)}${locked ? " / まだ解放されていません" : ""}</span>
      </button>
    `;
  });

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>エリア選択</strong>
        <button onclick="showTitle()">タイトル</button>
      </div>

      <div class="box">
        <h2>${escapeHtml(getPlayerName())}の行き先</h2>
        <p>6つのエリアをすべてクリアすると、最終決戦「マヨイの塔」が解放されます。</p>
        <span class="tag">${escapeHtml(getTitleName())}</span>
      </div>

      ${areaButtons}

      <div class="btn-area">
        <button class="sub" onclick="showReviewMode()">復習モード</button>
        <button class="sub" onclick="showStats()">成績を見る</button>
      </div>
    </div>
  `;
}

function showBeforeFinal(areaId) {
  const area = SAFE_AREAS.find(function(item) {
    return item.id === areaId;
  });

  if (!area) {
    showAreaSelect();
    return;
  }

  if (area.final && !isFinalAreaUnlocked()) {
    alert("マヨイの塔は、通常エリアをすべてクリアすると解放されます。");
    showAreaSelect();
    return;
  }

  pendingFinalAreaId = areaId;

  const story = Array.isArray(SAFE_STORY_TEXTS.beforeFinal) && SAFE_STORY_TEXTS.beforeFinal.length
    ? SAFE_STORY_TEXTS.beforeFinal
    : [
        "六つの地に広がっていた迷いは晴れ、主人公の手には希望の武器が集まった。",
        "しかし、マヨイの塔から、まだ暗い声が響いている。",
        "第六天の魔王が待っている。人間をあきらめさせる、根本の迷いそのものが。",
        "クローバードは翼を鳴らし、静かに前を見た。",
        "「怖いなら、それでいい。怖さを抱えたまま進める奴が、本当に強い。行くぞ。最後の迷いを斬る。」"
      ];

  let storyHtml = "";
  story.forEach(function(text) {
    storyHtml += `<p>${escapeHtml(applyStoryName(text))}</p>`;
  });

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>最終決戦前</strong>
        <button onclick="showAreaSelect()">戻る</button>
      </div>

      <div class="box command-window">
        <h2>${escapeHtml(area.name)}</h2>
        ${storyHtml}
      </div>

      <div class="box">
        <h3>クローバード</h3>
        <p>「${escapeHtml(pickLine("final"))}」</p>
      </div>

      <div class="btn-area">
        <button onclick="startBattle('${escapeAttr(area.id)}')">${escapeHtml(getBattleWord("finalButton", "最終決戦へ"))}</button>
        <button class="sub" onclick="showAreaSelect()">エリア選択へ</button>
      </div>
    </div>
  `;
}

function showStats() {
  loadGame();

  const rate = state.totalAnswers === 0
    ? 0
    : Math.round((state.totalCorrect / state.totalAnswers) * 100);

  const clearedNames = state.clearedAreas
    .map(function(id) {
      const area = SAFE_AREAS.find(function(item) {
        return item.id === id;
      });
      return area ? area.name : "";
    })
    .filter(function(name) {
      return name !== "";
    });

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>簡易成績</strong>
        <button onclick="showTitle()">タイトル</button>
      </div>

      <div class="box">
        <h2>${escapeHtml(getTitleName())}</h2>
        <p>${escapeHtml(getPlayerName())}とクローバードの冒険記録です。</p>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <span class="small">総回答数</span>
          <strong>${state.totalAnswers}</strong>
        </div>
        <div class="stat-card">
          <span class="small">総正解数</span>
          <strong>${state.totalCorrect}</strong>
        </div>
        <div class="stat-card">
          <span class="small">正答率</span>
          <strong>${rate}%</strong>
        </div>
        <div class="stat-card">
          <span class="small">間違えた問題</span>
          <strong>${state.wrongQuestionIds.length}</strong>
        </div>
      </div>

      <div class="box">
        <h3>クリア済みエリア</h3>
        <p>${clearedNames.length ? escapeHtml(clearedNames.join("、")) : "まだありません"}</p>
      </div>

      <div class="btn-area">
        <button onclick="showAreaSelect()">エリア選択へ</button>
        <button class="sub" onclick="showReviewMode()">復習モード</button>
        <button class="sub" onclick="showNameInput()">名前を変更する</button>
        <button class="danger" onclick="resetGame()">保存データを消す</button>
      </div>
    </div>
  `;
}

function showReviewMode() {
  loadGame();

  const wrongQuestions = state.wrongQuestionIds
    .map(function(id) {
      return SAFE_QUESTIONS.find(function(q) {
        return q.id === id;
      });
    })
    .filter(function(q) {
      return !!q;
    });

  if (!wrongQuestions.length) {
    app.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <strong>復習モード</strong>
          <button onclick="showAreaSelect()">戻る</button>
        </div>

        <div class="box command-window">
          <h2>復習する問題はありません</h2>
          <p>クローバード「${escapeHtml(pickLine("review"))}」</p>
          <p>今のところ、間違えた問題はありません。いい状態だ。</p>
        </div>

        <div class="btn-area">
          <button onclick="showAreaSelect()">エリア選択へ</button>
          <button class="sub" onclick="showStats()">成績を見る</button>
        </div>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>復習モード</strong>
        <button onclick="showAreaSelect()">戻る</button>
      </div>

      <div class="box command-window">
        <h2>間違えた問題に再挑戦</h2>
        <p>クローバード「${escapeHtml(pickLine("review"))}」</p>
        <p>復習対象：${wrongQuestions.length}問</p>
      </div>

      <div class="btn-area">
        <button onclick="startReviewBattle()">復習バトル開始</button>
        <button class="sub" onclick="showAreaSelect()">エリア選択へ</button>
      </div>
    </div>
  `;
}

function showEnding() {
  saveGame();

  const ending = Array.isArray(SAFE_STORY_TEXTS.ending) && SAFE_STORY_TEXTS.ending.length
    ? SAFE_STORY_TEXTS.ending
    : [
        "第六天の魔王は倒れ、マヨイの塔を覆っていた闇は静かに消えていった。",
        "世界に広がっていた霧は晴れ、人々の心に小さな光が戻り始める。"
      ];

  const afterword = Array.isArray(SAFE_STORY_TEXTS.endingAfterword) && SAFE_STORY_TEXTS.endingAfterword.length
    ? SAFE_STORY_TEXTS.endingAfterword
    : [
        "クローバードは言った。「迷いは何度でも来る。だが、学び、励まし、行動する心があれば、人はまた立てる。」",
        "「教学は、人を責めるための刃じゃない。人を立たせるための武器だ。忘れるなよ。」"
      ];

  let endingHtml = "";
  ending.forEach(function(text) {
    endingHtml += `<p>${escapeHtml(applyStoryName(text))}</p>`;
  });

  let afterwordHtml = "";
  afterword.forEach(function(text) {
    afterwordHtml += `<p>${escapeHtml(applyStoryName(text))}</p>`;
  });

  app.innerHTML = `
    <div class="screen ending-glow">
      <div class="title-box">
        <div class="title-inner">
          <div class="crest">🌈</div>
          <h1>完全クリア！</h1>
          <p class="subtitle">第六天の魔王を倒しました</p>
        </div>
      </div>

      <div class="box">
        <h2>迷いの塔に、光が差した</h2>
        ${endingHtml}
      </div>

      <div class="box command-window">
        ${afterwordHtml}
      </div>

      <div class="box reward-card">
        <h2>称号</h2>
        <p><strong>${escapeHtml(getTitleName())}</strong></p>
        <p class="small">希望の教学を胸に、これからも小さな一歩を。</p>
      </div>

      <div class="btn-area">
        <button onclick="showStats()">成績を見る</button>
        <button class="sub" onclick="showAreaSelect()">エリア選択へ</button>
        <button class="sub" onclick="showTitle()">タイトルへ</button>
      </div>
    </div>
  `;
}

function startBattle(areaId) {
  const area = SAFE_AREAS.find(function(item) {
    return item.id === areaId;
  });

  if (!area) {
    alert("エリア情報が見つかりませんでした。");
    showAreaSelect();
    return;
  }

  if (area.final && !isFinalAreaUnlocked()) {
    alert("マヨイの塔は、通常エリアをすべてクリアすると解放されます。");
    showAreaSelect();
    return;
  }

  const areaQuestions = SAFE_QUESTIONS.filter(function(question) {
    return question.area === areaId;
  });

  if (!areaQuestions.length) {
    app.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <strong>問題なし</strong>
          <button onclick="showAreaSelect()">戻る</button>
        </div>
        <div class="box">
          <h2>このエリアの問題がありません</h2>
          <p>data.js の QUESTIONS を確認してください。</p>
        </div>
      </div>
    `;
    return;
  }

  battle = {
    mode: "area",
    area: area,
    playerHp: PLAYER_MAX_HP,
    enemyHp: Number(area.hp) || 60,
    enemyMaxHp: Number(area.hp) || 60,
    questions: shuffleArray(areaQuestions),
    index: 0,
    currentQuestion: null,
    answered: false,
    selected: null,
    message: `${escapeHtml(area.boss)}「${escapeHtml(area.bossLine || "迷いの声が響いている…。")}」`
  };

  Question();
}

function startReviewBattle() {
  const reviewQuestions = state.wrongQuestionIds
    .map(function(id) {
      return SAFE_QUESTIONS.find(function(q) {
        return q.id === id;
      });
    })
    .filter(function(q) {
      return !!q;
    });

  if (!reviewQuestions.length) {
    showReviewMode();
    return;
  }

  const reviewArea = {
    id: "review",
    name: "復習の間",
    theme: "間違えた問題の復習",
    boss: "フクシュウノカゲ",
    mark: "📝",
    hp: REVIEW_ENEMY_HP,
    doubt: "忘れかけた学び",
    intro: "一度間違えた問題が、もう一度学ぶチャンスとして現れた。",
    bossLine: "また同じところで迷うかもしれないよ…？",
    clearText: "復習の光が、忘れかけた学びを照らし直した。",
    learn: ["間違いを見直すこと", "覚え直す勇気", "学び続ける姿勢"],
    rewardName: "復習のしおり",
    spriteClass: "enemy-book",
    spritePath: "",
    final: false
  };

  battle = {
    mode: "review",
    area: reviewArea,
    playerHp: PLAYER_MAX_HP,
    enemyHp: REVIEW_ENEMY_HP,
    enemyMaxHp: REVIEW_ENEMY_HP,
    questions: shuffleArray(reviewQuestions),
    index: 0,
    currentQuestion: null,
    answered: false,
    selected: null,
    message: `クローバード「${escapeHtml(pickLine("review"))}」`
  };

  Question();
}

function renderBattle() {
  if (!battle || !battle.currentQuestion) {
    showAreaSelect();
    return;
  }

  const question = battle.currentQuestion;
  const enemyPercent = Math.max(0, Math.round((battle.enemyHp / battle.enemyMaxHp) * 100));
  const playerPercent = Math.max(0, Math.round((battle.playerHp / PLAYER_MAX_HP) * 100));
  const isFinal = battle.area.final === true;

  let choicesHtml = "";

  question.choices.forEach(function(choice, index) {
    let buttonClass = "choice";

    if (battle.answered) {
      if (index === question.answer) {
        buttonClass += " correct";
      } else if (index === battle.selected) {
        buttonClass += " wrong";
      }
    }

    choicesHtml += `
      <button
        class="${buttonClass}"
        ${battle.answered ? "disabled" : ""}
        onclick="answerQuestion(${index})"
      >
        ${escapeHtml(choice)}
      </button>
    `;
  });

  const heroSprite = renderSprite({
    type: "hero",
    spriteClass: getHeroSpriteClass(),
    spritePath: getHeroSpritePath(),
    fallbackMark: getHeroFallbackMark()
  });

  const buddySprite = renderSprite({
    type: "buddy",
    spriteClass: getCloverbirdSpriteClass(),
    spritePath: getCloverbirdSpritePath(),
    fallbackMark: getCloverbirdFallbackMark()
  });

  const enemySprite = renderSprite({
    type: "monster",
    spriteClass: battle.area.spriteClass || "",
    spritePath: battle.area.spritePath || "",
    fallbackMark: battle.area.mark || "❖",
    final: isFinal
  });

  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <strong>${escapeHtml(battle.area.name)}</strong>
        <button onclick="showAreaSelect()">${escapeHtml(getBattleWord("runButton", "にげる"))}</button>
      </div>

      <div class="box">
        <h3>${escapeHtml(battle.area.theme)}</h3>
        <p class="small">${escapeHtml(battle.area.intro || "")}</p>
      </div>

      <div class="battle-field" id="battleField">
        <div class="status enemy-status">
          <strong>${escapeHtml(battle.area.boss)}</strong>
          <div class="hp-wrap">
            <div class="hp" style="width:${enemyPercent}%"></div>
          </div>
          <span class="small">HP ${battle.enemyHp} / ${battle.enemyMaxHp}</span>
        </div>

        <div class="sprite-row">
          <div class="party-sprites">
            ${heroSprite}
            ${buddySprite}
          </div>
          ${enemySprite}
        </div>

        <div class="status player-status">
          <strong>${escapeHtml(getPlayerName())} & クローバード</strong>
          <div class="hp-wrap">
            <div class="hp" style="width:${playerPercent}%"></div>
          </div>
          <span class="small">HP ${battle.playerHp} / ${PLAYER_MAX_HP}</span>
        </div>
      </div>

      <div class="question-box">
        <span class="tag">第${battle.index}問</span>
        <span class="tag">${escapeHtml(typeLabel(question.type))}</span>
        <p class="question">${escapeHtml(question.question)}</p>
      </div>

      <div class="choices">
        ${choicesHtml}
      </div>

      <div class="message">
        ${battle.message}
      </div>

      <div class="btn-area">
        ${battle.answered ? `<button onclick="nextQuestion()">${escapeHtml(getBattleWord("nextButton", "次へ"))}</button>` : ""}
      </div>
    </div>
  `;
}

function answerQuestion(choiceIndex) {
  if (!battle || battle.answered || !battle.currentQuestion) return;

  const question = battle.currentQuestion;
  const correct = choiceIndex === question.answer;

  battle.answered = true;
  battle.selected = choiceIndex;
  state.totalAnswers++;

  if (correct) {
    state.totalCorrect++;
    battle.enemyHp -= CORRECT_DAMAGE;

    if (battle.enemyHp < 0) {
      battle.enemyHp = 0;
    }

    removeWrongQuestion(question.id);

    const lineCategory = battle.area.final ? "final" : "correct";
    const powerText = question.powerText ? `<br><span class="small">${escapeHtml(question.powerText)}</span>` : "";

    battle.message = `
      <strong>${escapeHtml(getBattleWord("correctLabel", "正解！"))}</strong><br>
      クローバード「${escapeHtml(pickLine(lineCategory))}」<br>
      ${escapeHtml(battle.area.boss)}に${CORRECT_DAMAGE}${escapeHtml(getBattleWord("damageText", "ダメージ！"))}
      ${powerText}<br>
      <span class="small">${escapeHtml(question.explanation)}</span>
    `;

    saveGame();
    renderBattle();
    addTempClass("#battleField", "flash");
  } else {
    battle.playerHp -= WRONG_DAMAGE;

    if (battle.playerHp < 0) {
      battle.playerHp = 0;
    }

    addWrongQuestion(question.id);

    const correctChoice = question.choices[question.answer];

    battle.message = `
      <strong>${escapeHtml(getBattleWord("wrongLabel", "不正解…！"))}</strong><br>
      正解は「${escapeHtml(correctChoice)}」です。<br>
      クローバード「${escapeHtml(pickLine("wrong"))}」<br>
      <span class="small">${escapeHtml(question.explanation)}</span>
    `;

    saveGame();
    renderBattle();
    addTempClass("#battleField", "shake");
  }
}

function nextQuestion() {
  if (!battle) {
    showAreaSelect();
    return;
  }

  if (battle.enemyHp <= 0) {
    showVictory();
    return;
  }

  if (battle.playerHp <= 0) {
    showDefeat();
    return;
  }

  if (battle.index >= battle.questions.length) {
    battle.questions = shuffleArray(battle.questions);
    battle.index = 0;
  }

  function makeQuestionWithShuffledChoices(question) {
  if (!question || !Array.isArray(question.choices)) {
    return question;
  }

  const originalChoices = question.choices;
  const originalAnswerIndex = Number(question.answer);
  const correctChoice = originalChoices[originalAnswerIndex];

  const choiceObjects = originalChoices.map(function(choice, index) {
    return {
      text: choice,
      isCorrect: index === originalAnswerIndex
    };
  });

  const shuffledChoices = shuffleArray(choiceObjects);

  const newAnswerIndex = shuffledChoices.findIndex(function(choice) {
    return choice.isCorrect;
  });

  return {
    id: question.id,
    area: question.area,
    type: question.type,
    question: question.question,
    choices: shuffledChoices.map(function(choice) {
      return choice.text;
    }),
    answer: newAnswerIndex >= 0 ? newAnswerIndex : originalAnswerIndex,
    explanation: question.explanation,
    powerText: question.powerText
  };
}

 battle.currentQuestion = makeQuestionWithShuffledChoices(battle.questions[battle.index]);
 battle.index++;
 battle.answered = false;
 battle.selected = null;

  if (battle.index === 1) {
    battle.message = `${escapeHtml(battle.area.boss)}「${escapeHtml(battle.area.bossLine || "迷いの声が響いている…。")}」`;
  } else if (battle.area.final) {
    battle.message = `クローバード「${escapeHtml(pickLine("final"))}」`;
  } else if (battle.mode === "review") {
    battle.message = `クローバード「${escapeHtml(pickLine("review"))}」`;
  } else {
    battle.message = `クローバード「${escapeHtml(pickLine("start"))}」`;
  }

  renderBattle();
}

function showVictory() {
  if (!battle) {
    showAreaSelect();
    return;
  }

  if (battle.mode === "area" && !state.clearedAreas.includes(battle.area.id)) {
    state.clearedAreas.push(battle.area.id);
  }

  saveGame();

  if (battle.area.final) {
    showEnding();
    return;
  }

  let learnHtml = "";
  const learnItems = Array.isArray(battle.area.learn) ? battle.area.learn : [];

  learnItems.forEach(function(item) {
    learnHtml += `<li>${escapeHtml(item)}</li>`;
  });

  app.innerHTML = `
    <div class="screen victory-glow">
      <div class="title-box">
        <div class="title-inner">
          <div class="crest">✨</div>
          <h1>勝利！</h1>
          <p class="subtitle">${escapeHtml(battle.area.boss)}を倒しました</p>
        </div>
      </div>

      <div class="box command-window">
        <p>クローバード「${escapeHtml(pickLine("victory"))}」</p>
        <p>${escapeHtml(battle.area.clearText || "迷いの霧が晴れていきます。")}</p>
      </div>

      <div class="reward-card">
        <h2>${escapeHtml(getBattleWord("rewardText", "希望の武器を手に入れた！"))}</h2>
        <p><strong>${escapeHtml(battle.area.rewardName || "希望のしるし")}</strong></p>
      </div>

      <div class="box">
        <h2>${escapeHtml(getBattleWord("learnedText", "今回学んだこと"))}</h2>
        <ul class="learn-list">
          ${learnHtml || "<li>学びを力に変えること</li>"}
        </ul>
      </div>

      <div class="btn-area">
        <button onclick="showAreaSelect()">${escapeHtml(getBattleWord("areaSelectButton", "エリア選択へ"))}</button>
        <button class="sub" onclick="showStats()">${escapeHtml(getBattleWord("statsButton", "成績を見る"))}</button>
      </div>
    </div>
  `;
}

function showDefeat() {
  if (!battle) {
    showAreaSelect();
    return;
  }

  app.innerHTML = `
    <div class="screen">
      <div class="title-box">
        <div class="title-inner">
          <div class="crest">🌙</div>
          <h1>敗北…</h1>
          <p class="subtitle">${escapeHtml(getBattleWord("playerDefeated", "クローバードは力尽きた…"))}</p>
        </div>
      </div>

      <div class="box command-window">
        <p>クローバード「${escapeHtml(pickLine("defeat"))}」</p>
        <p>迷いは何度でも現れます。でも、何度でも挑戦できます。</p>
      </div>

      <div class="btn-area">
        <button onclick="${battle.mode === "review" ? "startReviewBattle()" : `startBattle('${escapeAttr(battle.area.id)}')`}">${escapeHtml(getBattleWord("retryButton", "もう一度挑戦"))}</button>
        <button class="sub" onclick="showAreaSelect()">${escapeHtml(getBattleWord("areaSelectButton", "エリア選択へ"))}</button>
      </div>
    </div>
  `;
}

function getTitleName() {
  const clearCount = state.clearedAreas.length;
  const rate = state.totalAnswers === 0 ? 0 : state.totalCorrect / state.totalAnswers;

  if (SAFE_TITLE_RULES.length) {
    const sortedRules = SAFE_TITLE_RULES.slice().sort(function(a, b) {
      const clearDiff = (Number(b.minCleared) || 0) - (Number(a.minCleared) || 0);
      if (clearDiff !== 0) return clearDiff;
      return (Number(b.minRate) || 0) - (Number(a.minRate) || 0);
    });

    for (let i = 0; i < sortedRules.length; i++) {
      const rule = sortedRules[i];
      const minCleared = Number(rule.minCleared) || 0;
      const minRate = Number(rule.minRate) || 0;

      if (clearCount >= minCleared && rate >= minRate) {
        return rule.title || "教学の旅人";
      }
    }
  }

  if (state.clearedAreas.includes("tower")) return "ミョウホウ・チャンピオン";
  if (clearCount >= 5) return "広布の勇者";
  if (clearCount >= 3) return "迷いを斬る冒険者";
  if (clearCount >= 1 && rate >= 0.7) return "希望を鍛える者";
  return "教学の旅人";
}

function addWrongQuestion(id) {
  if (!state.wrongQuestionIds.includes(id)) {
    state.wrongQuestionIds.push(id);
  }
}

function removeWrongQuestion(id) {
  state.wrongQuestionIds = state.wrongQuestionIds.filter(function(wrongId) {
    return wrongId !== id;
  });
}

function shuffleArray(array) {
  const copied = Array.isArray(array) ? array.slice() : [];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copied[i];
    copied[i] = copied[j];
    copied[j] = temp;
  }

  return copied;
}

function pickLine(category) {
  if (
    SAFE_CLOVERBIRD_LINES &&
    Array.isArray(SAFE_CLOVERBIRD_LINES[category]) &&
    SAFE_CLOVERBIRD_LINES[category].length > 0
  ) {
    const lines = SAFE_CLOVERBIRD_LINES[category];
    const index = Math.floor(Math.random() * lines.length);
    return lines[index];
  }

  if (category === "correct") return "いい一撃だ。今の答えは、迷いに効いたぜ。";
  if (category === "wrong") return "外したか。なら覚えろ。それで一歩前だ。";
  if (category === "victory") return "よし。迷いは斬った。だが、次の戦いに備えろ。";
  if (category === "defeat") return "倒れたか。だが、終わりじゃない。立ち上がるまでが勝負だ。";
  if (category === "final") return "ここまで来たんだ。最後まで腹を決めろ。";
  if (category === "review") return "復習だ。地味だが、こういう戦いが一番効く。";

  return "焦るな。答えは、積み上げた学びの中にある。";
}

function isFinalAreaUnlocked() {
  const normalAreas = SAFE_AREAS.filter(function(area) {
    return !area.final;
  });

  if (!normalAreas.length) return false;

  return normalAreas.every(function(area) {
    return state.clearedAreas.includes(area.id);
  });
}

function renderSprite(options) {
  const type = options.type || "monster";
  const spriteClass = options.spriteClass || "";
  const spritePath = options.spritePath || "";
  const fallbackMark = options.fallbackMark || "❖";
  const finalClass = options.final ? "final boss-aura" : "";

  if (spritePath) {
    return `
      <div class="${type} ${finalClass}">
        <img class="pixel-sprite-img" src="${escapeAttr(spritePath)}" alt="${escapeAttr(fallbackMark)}">
      </div>
    `;
  }

  if (spriteClass) {
    return `<div class="${type} pixel-sprite ${spriteClass} ${finalClass}" aria-label="${escapeAttr(fallbackMark)}"></div>`;
  }

  return `<div class="${type} ${finalClass}">${escapeHtml(fallbackMark)}</div>`;
}

function getDefaultHeroName() {
  if (SAFE_CHARACTERS.defaultHeroName) {
    return sanitizePlayerName(SAFE_CHARACTERS.defaultHeroName);
  }
  return "ユウキ";
}

function getPlayerName() {
  return sanitizePlayerName(state.playerName || getDefaultHeroName());
}

function sanitizePlayerName(value) {
  const text = String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 10);

  return text || "ユウキ";
}

function applyStoryName(text) {
  return String(text || "")
    .replace(/主人公/g, getPlayerName())
    .replace(/ユウキ/g, getPlayerName());
}

function getHeroSpriteClass() {
  return SAFE_CHARACTERS.hero && SAFE_CHARACTERS.hero.spriteClass
    ? SAFE_CHARACTERS.hero.spriteClass
    : "sprite-hero";
}

function getHeroSpritePath() {
  return SAFE_CHARACTERS.hero && SAFE_CHARACTERS.hero.spritePath
    ? SAFE_CHARACTERS.hero.spritePath
    : "";
}

function getHeroFallbackMark() {
  return SAFE_CHARACTERS.hero && SAFE_CHARACTERS.hero.fallbackMark
    ? SAFE_CHARACTERS.hero.fallbackMark
    : "🧑";
}

function getCloverbirdSpriteClass() {
  return SAFE_CHARACTERS.cloverbird && SAFE_CHARACTERS.cloverbird.spriteClass
    ? SAFE_CHARACTERS.cloverbird.spriteClass
    : "sprite-cloverbird";
}

function getCloverbirdSpritePath() {
  return SAFE_CHARACTERS.cloverbird && SAFE_CHARACTERS.cloverbird.spritePath
    ? SAFE_CHARACTERS.cloverbird.spritePath
    : "";
}

function getCloverbirdFallbackMark() {
  return SAFE_CHARACTERS.cloverbird && SAFE_CHARACTERS.cloverbird.fallbackMark
    ? SAFE_CHARACTERS.cloverbird.fallbackMark
    : "🍀";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function addTempClass(selector, className) {
  setTimeout(function() {
    const element = document.querySelector(selector);
    if (!element) return;

    element.classList.add(className);

    setTimeout(function() {
      element.classList.remove(className);
    }, 280);
  }, 20);
}

function getBattleWord(key, fallback) {
  if (SAFE_BATTLE_WORDS && typeof SAFE_BATTLE_WORDS[key] === "string") {
    return SAFE_BATTLE_WORDS[key];
  }

  return fallback;
}

function typeLabel(type) {
  const labels = {
    year: "年号",
    term: "用語",
    meaning: "意味",
    practice: "実践",
    life: "生活"
  };

  return labels[type] || "問題";
}

window.initGame = initGame;
window.defaultState = defaultState;
window.loadGame = loadGame;
window.saveGame = saveGame;
window.hasSave = hasSave;
window.resetGame = resetGame;

window.showTitle = showTitle;
window.showNameInput = showNameInput;
window.savePlayerNameAndStart = savePlayerNameAndStart;
window.startWithDefaultName = startWithDefaultName;
window.continueGame = continueGame;
window.showPrologue = showPrologue;
window.showAreaSelect = showAreaSelect;
window.showBeforeFinal = showBeforeFinal;
window.showStats = showStats;
window.showReviewMode = showReviewMode;
window.showEnding = showEnding;

window.startBattle = startBattle;
window.startReviewBattle = startReviewBattle;
window.renderBattle = renderBattle;
window.answerQuestion = answerQuestion;
window.nextQuestion = nextQuestion;
window.showVictory = showVictory;
window.showDefeat = showDefeat;

window.getTitleName = getTitleName;
window.addWrongQuestion = addWrongQuestion;
window.removeWrongQuestion = removeWrongQuestion;
window.shuffleArray = shuffleArray;
window.pickLine = pickLine;
window.isFinalAreaUnlocked = isFinalAreaUnlocked;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.addTempClass = addTempClass;
window.makeQuestionWithShuffledChoices = makeQuestionWithShuffledChoices;

document.addEventListener("DOMContentLoaded", function() {
  initGame();
});
