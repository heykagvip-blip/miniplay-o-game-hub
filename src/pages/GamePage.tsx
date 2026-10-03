import React from 'react';
import { SnakeGame } from '../games/SnakeGame';
import { TetrisGame } from '../games/TetrisGame';
import { Game2048 } from '../games/Game2048';
import { Minesweeper } from '../games/Minesweeper';
import { MemoryCard } from '../games/MemoryCard';
import { TicTacToe } from '../games/TicTacToe';
import { PongGame } from '../games/PongGame';
import { RockPaperScissors } from '../games/RockPaperScissors';
import { ConnectFour } from '../games/ConnectFour';
import { NumberGuess } from '../games/NumberGuess';

// New Games
import { FlappyBirdGame } from '../games/FlappyBirdGame';
import { BreakoutGame } from '../games/BreakoutGame';
import { Puzzle15Game } from '../games/Puzzle15Game';
import { WhackAMoleGame } from '../games/WhackAMoleGame';
import { SudokuGame } from '../games/SudokuGame';
import { SolitaireGame } from '../games/SolitaireGame';
import { CheckersGame } from '../games/CheckersGame';
import { ChessGame } from '../games/ChessGame';
import { DoodleJumpGame } from '../games/DoodleJumpGame';
import { WordleGame } from '../games/WordleGame';
import { SimonGame } from '../games/SimonGame';
import { BattleshipGame } from '../games/BattleshipGame';
import { PegSolitaireGame } from '../games/PegSolitaireGame';
import { BlackjackGame } from '../games/BlackjackGame';
import { MiniGolfGame } from '../games/MiniGolfGame';
import { UnoGame } from '../games/UnoGame';
import { AsteroidsGame } from '../games/AsteroidsGame';
import { SpaceInvadersGame } from '../games/SpaceInvadersGame';
import { FroggerGame } from '../games/FroggerGame';
import { BinaryPuzzleGame } from '../games/BinaryPuzzleGame';
import { NumberlinkGame } from '../games/NumberlinkGame';
import { HexGame } from '../games/HexGame';
import { ChompGame } from '../games/ChompGame';
import { HangmanGame } from '../games/HangmanGame';
import { WordSearchGame } from '../games/WordSearchGame';
import { MastermindGame } from '../games/MastermindGame';
import { MasyuGame } from '../games/MasyuGame';
import { LightUpGame } from '../games/LightUpGame';
import { NonogramGame } from '../games/NonogramGame';
import { NurikabeGame } from '../games/NurikabeGame';
import { DotsAndBoxesGame } from '../games/DotsAndBoxesGame';
import { ReversiGame } from '../games/ReversiGame';

// Arcade & Board Pack
import { AirHockeyGame } from '../games/AirHockeyGame';
import { FruitNinjaGame } from '../games/FruitNinjaGame';
import { GomokuGame } from '../games/GomokuGame';
import { MancalaGame } from '../games/MancalaGame';
import { MathDuelGame } from '../games/MathDuelGame';

// New Wave
import { GoGame } from '../games/GoGame';
import { MatchThreeGame } from '../games/MatchThreeGame';
import { StackTowerGame } from '../games/StackTowerGame';
import { TowerOfHanoiGame } from '../games/TowerOfHanoiGame';
import { WordAnagramGame } from '../games/WordAnagramGame';

interface GamePageProps {
  gameId: string;
  onBackToHub: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ gameId, onBackToHub }) => {
  switch (gameId) {
    case 'snake':
      return <SnakeGame onBackToHub={onBackToHub} />;
    case 'tetris':
      return <TetrisGame onBackToHub={onBackToHub} />;
    case '2048':
      return <Game2048 onBackToHub={onBackToHub} />;
    case 'minesweeper':
      return <Minesweeper onBackToHub={onBackToHub} />;
    case 'memory':
      return <MemoryCard onBackToHub={onBackToHub} />;
    case 'tictactoe':
      return <TicTacToe onBackToHub={onBackToHub} />;
    case 'pong':
      return <PongGame onBackToHub={onBackToHub} />;
    case 'rps':
      return <RockPaperScissors onBackToHub={onBackToHub} />;
    case 'connect-four':
      return <ConnectFour onBackToHub={onBackToHub} />;
    case 'number-guess':
      return <NumberGuess onBackToHub={onBackToHub} />;
    
    // New Games
    case 'flappy-bird':
      return <FlappyBirdGame onBackToHub={onBackToHub} />;
    case 'breakout':
      return <BreakoutGame onBackToHub={onBackToHub} />;
    case 'puzzle-15':
      return <Puzzle15Game onBackToHub={onBackToHub} />;
    case 'whack-a-mole':
      return <WhackAMoleGame onBackToHub={onBackToHub} />;
    case 'sudoku':
      return <SudokuGame onBackToHub={onBackToHub} />;
    case 'solitaire':
      return <SolitaireGame onBackToHub={onBackToHub} />;
    case 'checkers':
      return <CheckersGame onBackToHub={onBackToHub} />;
    case 'chess':
      return <ChessGame onBackToHub={onBackToHub} />;
    case 'doodle-jump':
      return <DoodleJumpGame onBackToHub={onBackToHub} />;
    case 'wordle':
      return <WordleGame onBackToHub={onBackToHub} />;
    case 'simon':
      return <SimonGame onBackToHub={onBackToHub} />;
    case 'battleship':
      return <BattleshipGame onBackToHub={onBackToHub} />;
    case 'peg-solitaire':
      return <PegSolitaireGame onBackToHub={onBackToHub} />;
    case 'blackjack':
      return <BlackjackGame onBackToHub={onBackToHub} />;
    case 'mini-golf':
      return <MiniGolfGame onBackToHub={onBackToHub} />;
    case 'uno':
      return <UnoGame onBackToHub={onBackToHub} />;
    case 'asteroids':
      return <AsteroidsGame onBackToHub={onBackToHub} />;
    case 'space-invaders':
      return <SpaceInvadersGame onBackToHub={onBackToHub} />;
    case 'frogger':
      return <FroggerGame onBackToHub={onBackToHub} />;

    // Additional Games
    case 'binary-puzzle':
      return <BinaryPuzzleGame onBackToHub={onBackToHub} />;
    case 'numberlink':
      return <NumberlinkGame onBackToHub={onBackToHub} />;
    case 'hex':
      return <HexGame onBackToHub={onBackToHub} />;
    case 'chomp':
      return <ChompGame onBackToHub={onBackToHub} />;
    case 'hangman':
      return <HangmanGame onBackToHub={onBackToHub} />;
    case 'word-search':
      return <WordSearchGame onBackToHub={onBackToHub} />;
    case 'mastermind':
      return <MastermindGame onBackToHub={onBackToHub} />;
    case 'masyu':
      return <MasyuGame onBackToHub={onBackToHub} />;
    case 'light-up':
      return <LightUpGame onBackToHub={onBackToHub} />;
    case 'nonogram':
      return <NonogramGame onBackToHub={onBackToHub} />;
    case 'nurikabe':
      return <NurikabeGame onBackToHub={onBackToHub} />;
    case 'dots-and-boxes':
      return <DotsAndBoxesGame onBackToHub={onBackToHub} />;
    case 'reversi':
      return <ReversiGame onBackToHub={onBackToHub} />;

    // Arcade & Board Pack
    case 'air-hockey':
      return <AirHockeyGame onBackToHub={onBackToHub} />;
    case 'fruit-ninja':
      return <FruitNinjaGame onBackToHub={onBackToHub} />;
    case 'gomoku':
      return <GomokuGame onBackToHub={onBackToHub} />;
    case 'mancala':
      return <MancalaGame onBackToHub={onBackToHub} />;
    case 'math-duel':
      return <MathDuelGame onBackToHub={onBackToHub} />;

    // New Wave
    case 'go':
      return <GoGame onBackToHub={onBackToHub} />;
    case 'match-three':
      return <MatchThreeGame onBackToHub={onBackToHub} />;
    case 'stack-tower':
      return <StackTowerGame onBackToHub={onBackToHub} />;
    case 'tower-of-hanoi':
      return <TowerOfHanoiGame onBackToHub={onBackToHub} />;
    case 'word-anagram':
      return <WordAnagramGame onBackToHub={onBackToHub} />;

    default:
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Trò chơi không tồn tại</h2>
          <button
            onClick={onBackToHub}
            className="px-4 py-2 bg-indigo-600 rounded-xl text-white text-sm"
          >
            Quay về Game Hub
          </button>
        </div>
      );
  }
};
