import { GameMetadata } from '../types';

export const GAMES: GameMetadata[] = [
  {
    id: 'snake',
    name: 'Snake',
    vietnameseName: 'Rắn Săn Mồi',
    description: 'Điều khiển chú rắn háu ăn thu thập táo đỏ và táo vàng, tránh va chạm vào đuôi hoặc tường!',
    category: 'arcade',
    difficulty: 'Dễ',
    icon: '🐍',
    color: 'from-emerald-500 to-green-700',
    controls: ['Phím mũi tên hoặc W A S D để chuyển hướng', 'D-pad cảm ứng tiện lợi trên điện thoại', 'Phím Space để tạm dừng'],
    instructions: [
      'Ăn quả táo đỏ để tăng 10 điểm và dài thêm 1 đốt.',
      'Táo vàng may mắn thỉnh thoảng xuất hiện mang lại 50 điểm!',
      'Càng ăn nhiều, tốc độ di chuyển của rắn sẽ càng tăng dần.',
      'Trò chơi kết thúc nếu rắn tự cắn vào thân mình hoặc đâm vào thành tường.'
    ],
    isFeatured: true,
    tags: ['cổ điển', 'arcade', 'nhanh tay', 'điểm cao']
  },
  {
    id: 'tetris',
    name: 'Tetris',
    vietnameseName: 'Xếp Hình Tetris',
    description: 'Trò chơi xếp các khối gạch kinh điển thế giới. Xoay, căn chỉnh và xóa các hàng ngang để ghi điểm số khổng lồ!',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🧱',
    color: 'from-blue-500 to-indigo-700',
    controls: ['← → : Di chuyển khối sang hai bên', '↑ / W : Xoay khối gạch', '↓ / S : Rơi nhanh (Soft Drop)', 'Space : Thả rơi tức thì (Hard Drop)'],
    instructions: [
      'Sắp xếp các khối gạch rơi xuống để lấp đầy hàng ngang không còn khoảng trống.',
      'Khi một hoặc nhiều hàng được lấp đầy, chúng sẽ phát nổ xóa hàng và cộng điểm thưởng.',
      'Cố gắng xóa 4 hàng cùng một lúc để đạt cú "TETRIS" huyền thoại!',
      'Tốc độ rơi sẽ tăng theo từng cấp độ (Level).'
    ],
    isFeatured: true,
    tags: ['puzzle', 'xếp hình', 'kinh điển', 'trí tuệ']
  },
  {
    id: '2048',
    name: '2048',
    vietnameseName: '2048 Hợp Nhất',
    description: 'Trượt các ô số giống nhau để cộng dồn lên 2048 và xa hơn nữa. Lối chơi giải đố gây nghiện nhất!',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🔢',
    color: 'from-amber-500 to-orange-700',
    controls: ['Vuốt màn hình cảm ứng theo 4 hướng', 'Phím mũi tên hoặc W A S D trên máy tính'],
    instructions: [
      'Mỗi lượt, dùng phím hoặc vuốt để đẩy tất cả các ô số về cùng một hướng.',
      'Hai ô có cùng giá trị khi chạm vào nhau sẽ hợp nhất thành một ô có giá trị gấp đôi (2+2=4, 4+4=8...).',
      'Sau mỗi lượt di chuyển, một ô số mới (2 hoặc 4) sẽ ngẫu nhiên xuất hiện trên bảng.',
      'Chiến thắng khi bạn tạo ra được ô số 2048! Bạn có thể tiếp tục chơi để lập kỷ lục vô tận.'
    ],
    isFeatured: true,
    tags: ['2048', 'logic', 'toán học', 'gây nghiện']
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    vietnameseName: 'Dò Mìn Cổ Điển',
    description: 'Vận dụng tư duy logic để mở toàn bộ các ô an toàn và cắm cờ đánh dấu những quả mìn ẩn giấu!',
    category: 'strategy',
    difficulty: 'Khó',
    icon: '💣',
    color: 'from-rose-500 to-red-700',
    controls: ['Nhấp chuột trái / Chạm: Mở ô', 'Nhấp chuột phải / Nút cờ: Đặt cờ mìn', 'Nút mặt cười: Khởi động lại'],
    instructions: [
      'Nước đi đầu tiên luôn luôn an toàn 100%!',
      'Các con số hiển thị số lượng mìn nằm trong 8 ô liền kề xung quanh nó.',
      'Dùng cờ để đánh dấu những ô bạn nghi ngờ có mìn.',
      'Mở hết tất cả các ô không có mìn trên bàn cờ để giành chiến thắng vinh quang.'
    ],
    isFeatured: false,
    tags: ['dò mìn', 'chiến thuật', 'suy luận', 'trí não']
  },
  {
    id: 'memory',
    name: 'Memory Card',
    vietnameseName: 'Lật Thẻ Trí Nhớ',
    description: 'Thử thách trí nhớ siêu phàm bằng cách tìm kiếm các cặp thẻ biểu tượng giống hệt nhau trong thời gian ngắn nhất!',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '🃏',
    color: 'from-purple-500 to-fuchsia-700',
    controls: ['Chạm hoặc nhấp chuột vào từng thẻ bài để lật mở'],
    instructions: [
      'Bàn chơi gồm các cặp thẻ bài được úp mặt xuống.',
      'Lật mở 2 thẻ bất kỳ mỗi lượt. Nếu 2 thẻ giống nhau, chúng sẽ được giữ mở vĩnh viễn.',
      'Nếu 2 thẻ khác nhau, chúng sẽ tự động úp lại sau một thoáng.',
      'Ghi nhớ vị trí và ghép cặp toàn bộ thẻ bài với số lượt di chuyển ít nhất để đạt 3 sao!'
    ],
    isFeatured: false,
    tags: ['trí nhớ', 'thư giãn', 'trẻ em', 'tập trung']
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    vietnameseName: 'Cờ Caro 3x3',
    description: 'Trò chơi đối kháng X-O kinh điển. Thử thách bản thân trước trí tuệ nhân tạo AI thông minh hoặc chơi cùng bạn bè!',
    category: 'board',
    difficulty: 'Dễ',
    icon: '⭕',
    color: 'from-cyan-500 to-blue-700',
    controls: ['Nhấp / Chạm vào ô trống trên bàn cờ 3x3 để đặt dấu X hoặc O'],
    instructions: [
      'Người chơi lần lượt đặt ký hiệu X hoặc O vào ô còn trống.',
      'Ai tạo được một đường thẳng gồm 3 ký hiệu liên tiếp (ngang, dọc hoặc chéo) trước sẽ chiến thắng.',
      'Hỗ trợ chế độ đấu với AI (Dễ, Vừa, Khó Minimax) hoặc 2 người chơi trên cùng thiết bị.'
    ],
    isFeatured: false,
    tags: ['caro', 'đối kháng', '2 người', 'nhanh']
  },
  {
    id: 'pong',
    name: 'Pong',
    vietnameseName: 'Bóng Bàn Pong',
    description: 'Trò chơi điện tử đầu tiên trong lịch sử loài người! Đỡ bóng, điều hướng góc đánh hiểm hóc và hạ gục đối thủ máy tính.',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '🏓',
    color: 'from-teal-500 to-emerald-700',
    controls: ['Phím W/S hoặc ↑/↓ để di chuyển vợt', 'Kéo rê chuột hoặc vuốt chạm ngón tay trên màn hình'],
    instructions: [
      'Điều khiển thanh vợt bên trái của bạn để đỡ bóng nảy lại đối thủ.',
      'Góc nảy của bóng phụ thuộc vào điểm tiếp xúc trên mặt vợt (đánh ở rìa vợt bóng sẽ bay chéo gắt).',
      'Mỗi lần bóng qua mặt đối thủ, bạn nhận 1 điểm. Tốc độ bóng sẽ tăng dần theo từng lượt đỡ!'
    ],
    isFeatured: true,
    tags: ['pong', 'arcade', 'bóng bàn', 'phản xạ']
  },
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    vietnameseName: 'Kéo Búa Bao',
    description: 'Trò chơi dân gian Kéo - Búa - Bao quen thuộc với hiệu ứng hoạt hình sống động và chuỗi thắng kịch tính!',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '✌️',
    color: 'from-violet-500 to-purple-800',
    controls: ['Chọn ✊ Búa, ✋ Bao hoặc ✌️ Kéo từ thanh lựa chọn'],
    instructions: [
      'Búa thắng Kéo, Kéo thắng Bao, Bao thắng Búa.',
      'Đạt chuỗi thắng (Win Streak) càng dài càng nhận được nhiều điểm thưởng danh dự.',
      'Có bảng theo dõi tỷ lệ Thắng - Thua - Hòa chi tiết qua từng ván đấu.'
    ],
    isFeatured: false,
    tags: ['dân gian', 'may mắn', 'nhanh', 'vui vẻ']
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    vietnameseName: 'Bốn Quân Thẳng Hàng',
    description: 'Thả quân cờ vào các cột lưới 7x6 và kết nối 4 quân cờ cùng màu thành hàng thẳng trước đối phương!',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '🔴',
    color: 'from-blue-600 to-indigo-900',
    controls: ['Nhấp vào cột bất kỳ để thả quân cờ rơi xuống đáy lưới'],
    instructions: [
      'Mỗi lượt, người chơi thả một đồng xu vào một trong 7 cột.',
      'Đồng xu sẽ rơi xuống vị trí trống thấp nhất trong cột đó.',
      'Người đầu tiên xếp được 4 đồng xu liên tiếp theo hàng ngang, hàng dọc hoặc đường chéo sẽ giành chiến thắng!',
      'Hỗ trợ chế độ chơi 2 người trên máy hoặc đấu với máy tính.'
    ],
    isFeatured: false,
    tags: ['chiến thuật', 'boardgame', 'kết nối', 'trí tuệ']
  },
  {
    id: 'number-guess',
    name: 'Number Guessing',
    vietnameseName: 'Đoán Số Bí Mật',
    description: 'Giải mã con số bí ẩn của hệ thống bằng các gợi ý Cao/Thấp và đo lường khoảng cách nhiệt độ Nóng/Lạnh!',
    category: 'strategy',
    difficulty: 'Dễ',
    icon: '🎯',
    color: 'from-sky-500 to-indigo-700',
    controls: ['Nhập số dự đoán từ bàn phím hoặc nút bấm số và nhấn Đoán'],
    instructions: [
      'Hệ thống sẽ bí mật chọn một số ngẫu nhiên trong khoảng từ 1 đến 100.',
      'Sau mỗi lượt đoán, bạn sẽ nhận được gợi ý số bí mật LỚN HƠN hay NHỎ HƠN số bạn vừa nhập.',
      'Thanh nhiệt kế cảm biến sẽ báo bạn đang "Bỏng rát 🔥" (rất gần) hay "Lạnh cóng ❄️" (ở xa).',
      'Đoán đúng với số lượt ít nhất để đạt điểm kỷ lục tối đa!'
    ],
    isFeatured: false,
    tags: ['đoán số', 'logic', 'thư giãn', 'toán học']
  },
  {
    id: 'flappy-bird',
    name: 'Flappy Bird',
    vietnameseName: 'Vỗ Cánh Vượt Ống',
    description: 'Điều khiển chú chim vỗ cánh bay qua các chướng ngại vật đường ống hiểm trở, tránh va chạm và đạt điểm cao!',
    category: 'arcade',
    difficulty: 'Khó',
    icon: '🐥',
    color: 'from-amber-400 to-yellow-600',
    controls: ['Phím Space hoặc ↑ để vỗ cánh bay lên', 'Chạm vào bất kỳ vị trí nào trên màn hình cảm ứng'],
    instructions: [
      'Nhân vật sẽ liên tục chịu lực hút trọng lực và rơi xuống.',
      'Nhấp phím hoặc chạm màn hình để vỗ cánh bay lên một cự ly vừa phải.',
      'Canh chuẩn độ cao để lọt qua khoảng trống giữa hai đường ống xanh.',
      'Mỗi lần vượt qua an toàn một cặp ống nước bạn nhận được 1 điểm.',
      'Va chạm vào đường ống, chạm trần hoặc rơi xuống mặt đất sẽ kết thúc trò chơi.'
    ],
    isFeatured: true,
    tags: ['flappy', 'arcade', 'nhanh tay', 'thử thách']
  },
  {
    id: 'breakout',
    name: 'Breakout',
    vietnameseName: 'Phá Gạch Cổ Điển',
    description: 'Điều khiển thanh trượt đỡ quả bóng nảy lên phá hủy toàn bộ các bức tường gạch màu rực rỡ qua nhiều màn chơi!',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '🧱',
    color: 'from-pink-500 to-rose-700',
    controls: ['Phím ← → hoặc A / D để di chuyển thanh đỡ', 'Kéo rê ngón tay hoặc chuột trên màn hình'],
    instructions: [
      'Sử dụng thanh trượt ở đáy màn hình để đón và đánh bóng nảy lên trên.',
      'Góc nảy của bóng sẽ thay đổi tùy thuộc vào vị trí tiếp xúc trên thanh trượt.',
      'Phá hủy hết toàn bộ các viên gạch để vượt qua màn chơi và mở khóa cấp độ khó hơn.',
      'Bạn có 3 mạng chơi trong mỗi lượt thử thách. Đừng để bóng lọt xuống đáy!'
    ],
    isFeatured: true,
    tags: ['phá gạch', 'arkanoid', 'arcade', 'kinh điển']
  },
  {
    id: 'puzzle-15',
    name: '15 Puzzle',
    vietnameseName: 'Trượt Số 15',
    description: 'Trò chơi giải đố cơ học kinh điển: trượt các ô số vào vị trí trống để sắp xếp chúng theo thứ tự tăng dần từ 1 đến 15!',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🔢',
    color: 'from-emerald-500 to-teal-700',
    controls: ['Nhấp/Chạm vào ô số liền kề ô trống để trượt', 'Phím mũi tên để trượt số'],
    instructions: [
      'Bàn chơi gồm 15 ô số và 1 ô trống duy nhất.',
      'Bạn chỉ có thể di chuyển những ô nằm cạnh sát ô trống.',
      'Mục tiêu là đưa toàn bộ 15 ô số về đúng vị trí từ 1 đến 15 theo hàng ngang từ trên xuống dưới.',
      'Mỗi màn chơi đều được thuật toán sinh ra đảm bảo 100% có lời giải.'
    ],
    isFeatured: false,
    tags: ['puzzle', 'xếp số', 'logic', 'kinh điển']
  },
  {
    id: 'whack-a-mole',
    name: 'Whack-a-Mole',
    vietnameseName: 'Đập Chuột Vui Nhộn',
    description: 'Thử tài nhanh tay lẹ mắt đập những chú chuột tinh nghịch nhô lên khỏi hang trước khi thời gian đếm ngược kết thúc!',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '🔨',
    color: 'from-amber-500 to-orange-700',
    controls: ['Nhấp chuột hoặc chạm trực tiếp vào hang có chuột xuất hiện'],
    instructions: [
      'Đập trúng chuột thường 🐭 cộng 10 điểm.',
      'Đập trúng chuột vàng 🐹 nhận ngay 35 điểm thưởng cực khủng!',
      'Cẩn thận tránh xa hang có bom 💣 kẻo bị trừ 25 điểm và mất chuỗi combo.',
      'Đập trúng liên tiếp để nâng cao hệ số nhân điểm Combo!',
      'Thời gian có hạn trong 35 giây, tốc độ chuột xuất hiện sẽ nhanh dần.'
    ],
    isFeatured: false,
    tags: ['đập chuột', 'vui vẻ', 'nhanh tay', 'casual']
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    vietnameseName: 'Sudoku Trí Tuệ',
    description: 'Điền các chữ số từ 1 đến 9 vào lưới 9x9 sao cho mỗi hàng, mỗi cột và mỗi khối 3x3 không chứa bất kỳ số nào trùng lặp!',
    category: 'strategy',
    difficulty: 'Khó',
    icon: '🧩',
    color: 'from-sky-500 to-blue-700',
    controls: ['Chọn ô trên lưới 9x9', 'Nhập số 1-9 từ bàn phím hoặc bàn phím ảo bên dưới', 'Nút Ghi chú để đánh dấu các số dự đoán'],
    instructions: [
      'Mỗi hàng ngang phải chứa đủ các số từ 1 đến 9 không trùng lặp.',
      'Mỗi hàng dọc phải chứa đủ các số từ 1 đến 9 không trùng lặp.',
      'Mỗi khối ô vuông 3x3 viền đậm phải chứa đủ các số từ 1 đến 9.',
      'Sử dụng chế độ Ghi chú (Notes) để phác thảo các số khả dĩ.',
      'Có sẵn 3 quyền trợ giúp (Gợi ý) cho những tình huống hóc búa.'
    ],
    isFeatured: false,
    tags: ['sudoku', 'trí tuệ', 'logic', 'toán học']
  },
  {
    id: 'solitaire',
    name: 'Solitaire',
    vietnameseName: 'Xếp Bài Solitaire',
    description: 'Trò chơi xếp bài Klondike Solitaire huyền thoại. Sắp xếp toàn bộ 52 lá bài theo chất từ Át (A) đến Già (K) vào 4 cọc chuẩn!',
    category: 'casual',
    difficulty: 'Trung bình',
    icon: '♠️',
    color: 'from-violet-500 to-indigo-800',
    controls: ['Nhấp vào lá bài để tự động di chuyển thông minh', 'Nhấp cọc bài rút để lật thêm lá bài mới', 'Nút Hoàn tác để lùi lại nước đi vừa thực hiện'],
    instructions: [
      'Xây dựng 4 cọc Foundation ở trên cùng theo từng chất (Bích, Cơ, Rô, Tép) từ A đến K.',
      'Ở 7 cột Tableau bên dưới, xếp các lá bài theo thứ tự giảm dần và xen kẽ màu (Đỏ - Đen).',
      'Chỉ có quân K (Già) mới được đặt vào một cột bài trống.',
      'Nhấp vào một lá bài ngửa để hệ thống tự động kiểm tra và chuyển đến vị trí hợp lệ.'
    ],
    isFeatured: true,
    tags: ['solitaire', 'xếp bài', 'klondike', 'thư giãn']
  },
  {
    id: 'checkers',
    name: 'Checkers',
    vietnameseName: 'Cờ Đam Checkers',
    description: 'Cờ đam đối kháng 2 người trên bàn 8x8. Di chuyển chéo, nhảy qua đầu quân đối phương để bắt quân và phong cấp thành Vua!',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '🔴',
    color: 'from-red-600 to-neutral-900',
    controls: ['Nhấp vào quân cờ của bạn để xem các nước đi hợp lệ', 'Nhấp ô đích có chấm phát sáng để thực hiện di chuyển'],
    instructions: [
      'Quân thường chỉ được di chuyển chéo tiến lên 1 ô vào ô trống màu tối.',
      'Khi đối thủ đứng sát trước mặt và ô phía sau trống, bạn có thể nhảy qua để bắt quân.',
      'Hỗ trợ chuỗi nhảy liên hoàn bắt nhiều quân cờ trong cùng một lượt đi.',
      'Khi quân cờ đi tới hàng cuối cùng của bàn cờ đối phương, nó sẽ được phong cấp thành Vua (King) và có thể đi/bắt lùi.'
    ],
    isFeatured: false,
    tags: ['cờ đam', 'checkers', 'đối kháng', 'boardgame']
  },
  {
    id: 'chess',
    name: 'Chess',
    vietnameseName: 'Cờ Vua Tiêu Chuẩn',
    description: 'Môn thể thao trí tuệ đỉnh cao của nhân loại. Luật chơi tiêu chuẩn quốc tế FIDE với đầy đủ phong cấp, nhập thành và chiếu bí!',
    category: 'board',
    difficulty: 'Khó',
    icon: '♟️',
    color: 'from-slate-700 to-indigo-950',
    controls: ['Nhấp chọn quân cờ để xem các ô đi hợp lệ', 'Nhấp ô đích để di chuyển quân', 'Nút Hoàn tác để đi lại nước trước'],
    instructions: [
      'Chơi đối kháng 2 người trên cùng một thiết bị.',
      'Đầy đủ luật quốc tế: Nhập thành (Castling), Bắt tốt qua đường (En Passant), Phong cấp Tốt khi sang đáy đối phương.',
      'Cảnh báo Chiếu tướng trực quan khi Vua gặp nguy hiểm.',
      'Chiến thắng khi thực hiện nước đi Chiếu bí (Checkmate) đối thủ.'
    ],
    isFeatured: true,
    tags: ['cờ vua', 'chess', 'chiến thuật', 'đỉnh cao']
  },
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    vietnameseName: 'Nhảy Bật Vô Tận',
    description: 'Điều khiển sinh vật nhảy bật liên hồi qua các bậc thang xanh, lò xo nảy cao và nền tảng di động để chinh phục độ cao vũ trụ!',
    category: 'arcade',
    difficulty: 'Dễ',
    icon: '🦘',
    color: 'from-lime-500 to-emerald-700',
    controls: ['Phím mũi tên ← → hoặc A / D để di chuyển ngang', 'Nút bấm trái/phải trên màn hình điện thoại'],
    instructions: [
      'Nhân vật sẽ tự động nhảy bật lên khi chạm chân vào bề mặt bậc thang.',
      'Di chuyển sang hai bên để đáp trúng các bậc thang phía trên.',
      'Bậc thang lò xo màu tím 🚀 sẽ giúp bạn bật cực cao!',
      'Bậc thang màu xanh lam 🔵 sẽ liên tục trượt qua lại.',
      'Chạy xuyên mép màn hình: đi sang mép trái bạn sẽ xuất hiện lại ở mép phải!',
      'Rơi khỏi khung nhìn phía dưới sẽ kết thúc màn chơi.'
    ],
    isFeatured: true,
    tags: ['doodle', 'nhảy cao', 'vô tận', 'arcade']
  },
  {
    id: 'wordle',
    name: 'Wordle',
    vietnameseName: 'Đoán Từ 5 Chữ',
    description: 'Đoán từ tiếng Anh bí mật trong tối đa 6 lượt bằng các gợi ý màu sắc.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🔤',
    color: 'from-emerald-500 to-teal-700',
    controls: ['Nhập 5 chữ cái rồi nhấn Enter', 'Xanh lá đúng vị trí, vàng có trong từ'],
    instructions: ['Đoán từ gồm 5 chữ cái trong tối đa 6 lượt.', 'Màu xanh lá là đúng chữ và đúng vị trí; vàng là đúng chữ sai vị trí.'],
    tags: ['wordle', 'từ vựng', 'logic', 'offline']
  },
  {
    id: 'simon',
    name: 'Simon Says',
    vietnameseName: 'Nhớ Chuỗi Màu',
    description: 'Quan sát chuỗi màu rồi lặp lại chính xác để thử thách trí nhớ.',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '🎨',
    color: 'from-rose-500 to-amber-500',
    controls: ['Quan sát các ô sáng lên', 'Chạm hoặc nhấp các màu theo đúng thứ tự'],
    instructions: ['Mỗi lượt chuỗi sẽ dài thêm một màu.', 'Nhấn sai màu hoặc sai thứ tự là kết thúc ván.'],
    tags: ['trí nhớ', 'phản xạ', 'casual']
  },
  {
    id: 'battleship',
    name: 'Battleship',
    vietnameseName: 'Hải Chiến',
    description: 'Dò tọa độ và đánh chìm hạm đội đối phương trong trận hải chiến với máy.',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '🚢',
    color: 'from-sky-500 to-blue-800',
    controls: ['Chọn ô trên lưới đối thủ để bắn', 'Đỏ là trúng, xám là trượt'],
    instructions: ['Mỗi lượt bắn một tọa độ.', 'Đánh chìm toàn bộ 5 tàu của máy trước khi hạm đội bạn bị hạ.'],
    tags: ['hải chiến', 'chiến thuật', 'đấu máy']
  },
  {
    id: 'peg-solitaire',
    name: 'Peg Solitaire',
    vietnameseName: 'Nhảy Quân',
    description: 'Nhảy quân qua quân khác để loại dần khỏi bàn cờ và giữ lại một quân duy nhất.',
    category: 'puzzle',
    difficulty: 'Khó',
    icon: '🟢',
    color: 'from-emerald-500 to-green-800',
    controls: ['Chọn quân cờ', 'Chọn ô trống cách hai ô theo hàng hoặc cột'],
    instructions: ['Nhảy qua một quân liền kề để loại quân đó.', 'Mục tiêu là chỉ còn một quân trên bàn.'],
    tags: ['giải đố', 'bàn cờ', 'logic']
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    vietnameseName: 'Xì Dách 21',
    description: 'Bạn và hai đối thủ máy cùng rút bài để vượt qua nhà cái mà không vượt quá 21.',
    category: 'casual',
    difficulty: 'Trung bình',
    icon: '🂡',
    color: 'from-emerald-600 to-slate-900',
    controls: ['Chọn Rút bài hoặc Dừng', 'Át tính 1 hoặc 11 điểm'],
    instructions: ['Bạn và hai máy chơi theo lượt, mỗi người tự đấu với nhà cái.', 'Đánh bại nhà cái bằng tổng điểm gần 21 hơn.', 'Nhà cái phải rút đến ít nhất 17 điểm.'],
    tags: ['bài lá', 'blackjack', 'chiến thuật']
  },
  {
    id: 'mini-golf',
    name: 'Mini Golf',
    vietnameseName: 'Đánh Golf Mini',
    description: 'Ngắm hướng, canh lực và đưa bóng qua chướng ngại vật vào lỗ với ít gậy nhất.',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '⛳',
    color: 'from-lime-500 to-emerald-800',
    controls: ['Kéo bóng ngược hướng muốn đánh', 'Thả chuột hoặc ngón tay để đánh'],
    instructions: ['Kéo càng xa thì cú đánh càng mạnh.', 'Đưa bóng vào lỗ với ít gậy nhất để qua màn.', 'Chơi 9 màn; chướng ngại được sắp xếp lại và dày hơn sau mỗi màn.'],
    tags: ['golf', 'vật lý', 'độ chính xác']
  },
  {
    id: 'uno',
    name: 'UNO',
    vietnameseName: 'Bài UNO Đấu Máy',
    description: 'Đánh hết bài bằng cách khớp màu hoặc số, dùng lá chức năng và đấu với máy.',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '🃏',
    color: 'from-rose-600 to-amber-500',
    controls: ['Chọn lá cùng màu hoặc cùng số', 'Rút bài khi không thể đánh', 'Chọn màu khi đánh lá đổi màu'],
    instructions: ['Thi đấu vòng bàn gồm bạn và 3 máy.', 'Lá Skip bỏ lượt kế tiếp; Reverse đổi chiều đánh.', 'Lá +2 và +4 bắt người chơi kế tiếp rút bài và mất lượt.', 'Ai đánh hết bài trước sẽ thắng.'],
    tags: ['uno', 'bài lá', 'đấu máy', 'gia đình']
  },
  {
    id: 'asteroids',
    name: 'Asteroids',
    vietnameseName: 'Bắn Thiên Thạch',
    description: 'Lái phi thuyền giữa vũ trụ bao la, bắn phá những tảng thiên thạch khổng lồ thành từng mảnh nhỏ hơn và sống sót qua các màn chơi!',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '🚀',
    color: 'from-slate-700 to-sky-900',
    controls: [
      '← → hoặc A / D để xoay phi thuyền',
      '↑ hoặc W để đẩy tăng tốc về phía mũi tàu',
      'Space để bắn đạn phá thiên thạch',
      'Cụm nút cảm ứng 4 chiều trên màn hình điện thoại'
    ],
    instructions: [
      'Thiên thạch bay lơ lửng khắp màn hình, chúng sẽ xuất hiện lại ở bờ đối diện khi bay ra khỏi rìa.',
      'Đạn bắn trúng thiên thạch lớn sẽ tách nó thành 2 tảng nhỏ hơn, tảng càng nhỏ càng đáng giá điểm.',
      'Bị thiên thạch đâm trúng sẽ mất 1 mạng trong tổng số 6 mạng.',
      'Khi hồi sinh, mọi thiên thạch ở gần chỗ xuất hiện sẽ bốc hơi hết và bạn được bất tử vài giây.',
      'Bắn sạch toàn bộ thiên thạch để qua màn mới; tốc độ thiên thạch tăng dần nhưng luôn được giới hạn ở mức dễ chịu.'
    ],
    tags: ['thiên thạch', 'vũ trụ', 'arcade', 'bắn súng']
  },
  {
    id: 'space-invaders',
    name: 'Space Invaders',
    vietnameseName: 'Bắn Người Ngoài Hành Tinh',
    description: 'Chặn đứng đội quân người ngoài hành tinh đang tiến xuống từng bước. Bắn hạ toàn bộ đội hình trước khi chúng tràn tới vị trí của bạn!',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '👾',
    color: 'from-indigo-600 to-slate-900',
    controls: [
      '← → hoặc A / D để di chuyển bệ phóng',
      'Space để bắn đạn lên trên',
      'Nút trái / bắn / phải cảm ứng trên màn hình điện thoại'
    ],
    instructions: [
      'Đội hình gồm 4 hàng x 8 người ngoài hành tinh di chuyển ngang và tụt xuống mỗi khi chạm biên.',
      'Hàng trên cùng đáng giá điểm cao nhất, hàng dưới cùng ít điểm nhất.',
      'Bạn được bắn tối đa 3 viên đạn cùng lúc, hãy canh nhịp bắn hợp lý.',
      '4 lá chắn phía dưới có thể chặn đạn, nhưng mỗi lần trúng đạn sẽ xuyên thủng một phần của lá chắn.',
      'Người ngoài hành tinh bắn trả ngẫu nhiên, trúng đạn là mất 1 mạng trong 6 mạng.',
      'Thắng 4 đợt tấn công liên tiếp để giành chiến thắng hoàn toàn.',
      'Thua ngay lập tức nếu để đội hình tiến xuống ngang hàng với bệ phóng của bạn.'
    ],
    tags: ['người ngoài hành tinh', 'arcade', 'bắn súng', 'kinh điển']
  },
  {
    id: 'frogger',
    name: 'Frogger',
    vietnameseName: 'Ếch Qua Đường',
    description: 'Dẫn chú ếch nhảy qua 8 làn đường cao tốc đông xe cộ và đáp chính xác xuống lá sen bên bờ phía trên để ghi điểm!',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '🐸',
    color: 'from-green-500 to-teal-800',
    controls: [
      '← → ↑ ↓ hoặc W A S D để nhảy từng ô một',
      'Cụm nút mũi tên cảm ứng trên màn hình điện thoại'
    ],
    instructions: [
      'Mỗi bước nhảy lên một hàng mới chưa từng chạm tới cộng 10 điểm.',
      'Băng qua hết 8 làn đường rồi đáp trúng một lá sen để nhận 100 điểm và qua màn mới.',
      'Đáp xuống khoảng trống giữa các lá sen sẽ bị coi là rơi xuống nước và mất 1 mạng.',
      'Va vào xe hơi trên đường cũng mất 1 mạng, sau đó bạn được bất tử trong khoảng 2 giây.',
      'Mỗi màn mới xe sẽ chạy nhanh hơn một chút (vẫn có giới hạn), bạn có 4 mạng cho tới khi hết.'
    ],
    tags: ['ếch', 'arcade', 'phản xạ', 'kinh điển']
  },
  {
    id: 'binary-puzzle',
    name: 'Binary Puzzle',
    vietnameseName: 'Puzzle Nhị Phân',
    description: 'Điền 0 và 1 vào lưới sao cho mỗi hàng và cột cân bằng, không bao giờ có ba số giống nhau liên tiếp.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '⬛',
    color: 'from-slate-500 to-slate-700',
    controls: ['Chạm hoặc click vào ô để đổi 0 / 1', 'Phím mũi tên để di chuyển con trỏ', 'Phím 0, 1 hoặc Space để điền'],
    instructions: [
      'Mỗi ô chỉ nhận giá trị 0 hoặc 1, nhấn lần nữa để đổi.',
      'Trong mỗi hàng và cột, số ô 0 phải bằng đúng số ô 1.',
      'Không bao giờ để ba giá trị giống nhau đứng liên tiếp theo hàng ngang hay dọc.',
      'Mỗi đề đều chỉ có duy nhất một lời giải hợp lệ, hãy tự suy luận thay vì đoán mò.'
    ],
    tags: ['logic', 'suy luận', 'ô số', 'thử trí']
  },
  {
    id: 'numberlink',
    name: 'Numberlink',
    vietnameseName: 'Nối Số',
    description: 'Vẽ đường nối hai ô có cùng số, không cắt nhau, phủ kín toàn bộ bàn chơi.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🔗',
    color: 'from-cyan-500 to-blue-700',
    controls: ['Nhấn giữ từ một ô số rồi kéo để vẽ đường', 'Kéo ngược lại để thu đường về', 'Chạm vào ô số đã nối xong để xóa'],
    instructions: [
      'Mỗi số xuất hiện đúng hai lần trên bàn, hãy nối chúng thành một đường liền mạch.',
      'Các đường không được chạm, cắt hoặc đi qua ô của số khác.',
      'Đường đã nối đúng sẽ tự khóa lại khi hai đầu chạm nhau.',
      'Thắng khi mọi số đều nối xong và không ô nào bị bỏ trống.'
    ],
    tags: ['logic', 'nối đường', 'suy luận']
  },
  {
    id: 'hex',
    name: 'Hex',
    vietnameseName: 'Cờ Hex',
    description: 'Người chơi đen nối từ cạnh trên xuống cạnh dưới, người chơi trắng nối từ cạnh trái sang cạnh phải. Hòa là không thể xảy ra.',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '⬢',
    color: 'from-zinc-400 to-zinc-700',
    controls: ['Click vào ô lục giác trống để đặt quân của mình', 'Click vào quân của mình vừa đặt để đi lại nước đi'],
    instructions: [
      'Quân đen phải tạo đường liền mạch từ cạnh trên bàn xuống cạnh dưới.',
      'Quân trắng phải tạo đường liền mạch từ cạnh trái sang cạnh phải.',
      'Chơi lần lượt, mỗi lượt đặt một quân vào ô còn trống.',
      'Trong Hex không bao giờ có kết quả hòa, luôn có một người thắng.'
    ],
    tags: ['chiến thuật', 'hai người', 'bàn cờ', 'kinh điển']
  },
  {
    id: 'chomp',
    name: 'Chomp',
    vietnameseName: 'Cắn Kẹo Sô Cô Lô',
    description: 'Cắn mất một miếng cùng toàn bộ phần nằm phía trên và bên phải. Ai ăn phải ô độc phải thua.',
    category: 'board',
    difficulty: 'Dễ',
    icon: '🍫',
    color: 'from-amber-600 to-orange-800',
    controls: ['Click vào ô còn nguyên để cắn mất ô đó và mọi ô trên, bên phải', 'Nút đặt lại để chơi ván mới'],
    instructions: [
      'Bàn chơi là một khối sô cô lô hình chữ nhật, ô độc nằm ở góc dưới bên trái.',
      'Mỗi nước đi chọn một ô và ăn mất ô đó cùng tất cả ô nằm phía trên và bên phải.',
      'Người chơi buộc phải ăn ô độc sẽ thua ngay lập tức.',
      'Chơi hai người luân phiên trên cùng một thiết bị.'
    ],
    tags: ['chiến thuật', 'hai người', 'đơn giản']
  },
  {
    id: 'hangman',
    name: 'Hangman',
    vietnameseName: 'Đoán Từ Treo Cổ',
    description: 'Đoán từ bí mật bằng cách chọn từng chữ cái, mỗi lần đoán sai sẽ mất một mạng.',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '🔤',
    color: 'from-purple-500 to-violet-700',
    controls: ['Chọn chữ cái trên bàn phím ảo', 'Phím A-Z trên bàn phím máy tính cũng dùng được'],
    instructions: [
      'Máy chọn một từ bí mật và bạn phải đoán từng chữ cái một.',
      'Đoán đúng sẽ mở hết các vị trí của chữ đó, kể cả chữ lặp lại.',
      'Mỗi lần đoán sai trừ một mạng, hết mạng là thua.',
      'Bạn có thể dùng gợi ý để mở một chữ cái nhưng sẽ mất điểm.'
    ],
    tags: ['chữ', 'đoán từ', 'phổ thông']
  },
  {
    id: 'word-search',
    name: 'Word Search',
    vietnameseName: 'Tìm Từ Trong Lưới',
    description: 'Kéo chuột qua các ô chữ cái để tìm những từ đã ẩn ngang, dọc hoặc chéo.',
    category: 'puzzle',
    difficulty: 'Dễ',
    icon: '🔍',
    color: 'from-emerald-500 to-teal-700',
    controls: ['Nhấn giữ một chữ cái rồi kéo theo một hướng thẳng', 'Thả chuột để xác nhận từ đã chọn'],
    instructions: [
      'Mỗi lượt, kéo qua một đoạn chữ thẳng để chọn từ bạn nghĩ là đang ẩn.',
      'Từ có thể nằm ngang, dọc, chéo hoặc đọc ngược lại.',
      'Chọn đúng sẽ tô màu vĩnh viễn cho từ đó và cộng điểm.',
      'Thắng khi tìm được toàn bộ số từ trong danh sách.'
    ],
    tags: ['chữ', 'tìm kiếm', 'gây nghiện']
  },
  {
    id: 'mastermind',
    name: 'Mastermind',
    vietnameseName: 'Đoán Mã Số',
    description: 'Đoán dãy màu bí ẩn, mỗi lượt đoán bạn nhận biết đúng màu đúng chỗ và đúng màu sai chỗ.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🧿',
    color: 'from-rose-500 to-pink-700',
    controls: ['Chọn một ô rồi chọn màu để điền', 'Enter hoặc nút Xác nhận để gửi lượt đoán'],
    instructions: [
      'Máy chọn một dãy màu bí mật, bạn phải đoán đúng thứ tự.',
      'Sau mỗi lượt đoán bạn biết có bao nhiêu màu đúng chỗ và bao nhiêu màu đúng nhưng sai chỗ.',
      'Mỗi màu chỉ được tính một lần cho mỗi lần xuất hiện trong đáp án.',
      'Hết lượt mà chưa đoán trúng thì dãy bí ẩn sẽ được mở ra cho bạn xem.'
    ],
    tags: ['logic', 'suy luận', 'màu sắc']
  },
  {
    id: 'masyu',
    name: 'Masyu',
    vietnameseName: 'Vòng Masyu',
    description: 'Vẽ một vòng khép kín duy nhất qua lưới chấm, thỏa mãn mọi quả cầu trắng và đen trên đường đi.',
    category: 'puzzle',
    difficulty: 'Khó',
    icon: '⬤',
    color: 'from-indigo-400 to-indigo-700',
    controls: ['Kéo từ một chấm sang chấm kề để vẽ cạnh', 'Click vào cạnh đã vẽ để xóa', 'Nút Hiện lời giải để xem đáp án'],
    instructions: [
      'Mục tiêu là vẽ đúng một vòng khép kín duy nhất nối các chấm.',
      'Quả cầu trắng phải được đi thẳng qua, và vòng phải rẽ ở ít nhất một ô kề bên.',
      'Quả cầu đen phải rẽ tại chỗ, và vòng phải đi thẳng qua cả hai ô kề bên.',
      'Các cạnh của vòng không được tự cắt hoặc chạm chéo nhau.'
    ],
    tags: ['logic', 'vẽ đường', 'khó']
  },
  {
    id: 'light-up',
    name: 'Light Up',
    vietnameseName: 'Đèn Sáng',
    description: 'Đặt bóng đèn để soi sáng mọi ô trống, hai bóng không được nhìn thấy nhau và các số phải chính xác.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '💡',
    color: 'from-amber-400 to-amber-700',
    controls: ['Click vào ô để đặt hoặc bỏ bóng đèn', 'Chuột phải vào ô sáng để đánh dấu chắc chắn không có bóng'],
    instructions: [
      'Mỗi ô trống phải được chiếu sáng bởi chính nó hoặc bởi một bóng đèn cùng hàng cùng cột không bị tường chắn.',
      'Hai bóng đèn không được nhìn thấy nhau theo hàng ngang hoặc hàng dọc.',
      'Ô có số 1 đến 4 yêu cầu đúng số bóng đèn tính cả hàng và cột quanh nó.',
      'Thắng khi mọi ô đều sáng và không còn ô nào bị tối.'
    ],
    tags: ['logic', 'suy luận', 'ánh sáng']
  },
  {
    id: 'nonogram',
    name: 'Nonogram',
    vietnameseName: 'Tô Hình',
    description: 'Dựa vào dãy số ở mỗi hàng và cột, tô màu các ô vuông để dựng ra một bức hình ẩn.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🖼️',
    color: 'from-pink-400 to-rose-700',
    controls: ['Click vào ô để chuyển trống, tô, gạch chéo', 'Chuột phải để bỏ gạch chéo nhanh', 'Phím mũi tên để di chuyển con trỏ, Space để đổi trạng thái'],
    instructions: [
      'Dãy số bên trái mỗi hàng cho biết các đoạn ô liên tiếp cần tô, cách nhau ít nhất một ô trống.',
      'Dãy số phía trên mỗi cột có ý nghĩa tương tự theo chiều dọc.',
      'Ô gạch chéo nghĩa là ô chắc chắn không tô, dùng để gợi ý cho chính mình.',
      'Bức hình hoàn chỉnh khi tất cả ô tô khớp đúng với hình ẩn.'
    ],
    tags: ['logic', 'hình ảnh', 'thư giãn']
  },
  {
    id: 'nurikabe',
    name: 'Nurikabe',
    vietnameseName: 'Nurikabe',
    description: 'Mở rộng mỗi con số thành một đảo, rồi bao quanh bằng biển sao cho biển liền mạch và không có khối 2x2.',
    category: 'puzzle',
    difficulty: 'Khó',
    icon: '🏝️',
    color: 'from-sky-400 to-blue-800',
    controls: ['Click vào ô để chuyển giữa trống, đảo và biển', 'Chuột phải để đảo chiều vòng tròn', 'Phím mũi tên và Space để chơi bằng bàn phím'],
    instructions: [
      'Mỗi ô có số là trung tâm của một đảo chứa đúng số ô bằng giá trị đó.',
      'Hai đảo khác nhau không được chạm nhau, kể cả chạm theo đường chéo.',
      'Toàn bộ ô còn lại là biển và biển phải là một khối liền mạch duy nhất.',
      'Biển không được tạo thành khối vuông 2x2 đặc kín.'
    ],
    tags: ['logic', 'suy luận', 'khó']
  },
  {
    id: 'dots-and-boxes',
    name: 'Dots and Boxes',
    vietnameseName: 'Chấm Và Ô Vuông',
    description: 'Vẽ đường quanh các chấm, khép kín một ô vuông để chiếm nó và có thêm một nước đi liền.',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '⬚',
    color: 'from-lime-400 to-green-700',
    controls: ['Click vào giữa hai chấm kề nhau để vẽ hoặc xóa nét', 'Nút để bật máy đấu cùng bạn'],
    instructions: [
      'Bàn chơi là lưới chấm, giữa hai chấm kề nhau có thể kẻ một nét.',
      'Khi bạn khép kín đủ bốn cạnh của một ô vuông thì bạn chiếm ô đó và được đi tiếp.',
      'Chuỗi chiếm nhiều ô liên tiếp là chìa khóa để thắng.',
      'Ai chiếm được nhiều ô vuông hơn sẽ thắng trận.'
    ],
    tags: ['chiến thuật', 'hai người', 'bút chì']
  },
  {
    id: 'reversi',
    name: 'Reversi',
    vietnameseName: 'Cờ Othello',
    description: 'Đặt quân để kẹp chéo đối thủ và lật ngược hàng quân bị vây, đến cuối bàn ai nhiều quân hơn sẽ thắng.',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '⚫',
    color: 'from-emerald-600 to-teal-800',
    controls: ['Click vào ô trống để đặt quân', 'Nút gợi ý để đánh dấu một nước đi hợp lệ', 'Nút đi lại để hủy nước vừa rồi'],
    instructions: [
      'Mỗi nước đi phải kẹp được ít nhất một dãy quân đối phương.',
      'Tất cả quân bị kẹp theo mọi hướng sẽ lật sang màu của bạn.',
      'Bạn không được đặt ở ô không tạo ra dãy quân bị kẹp.',
      'Thắng khi hết ô trống, bên nào có nhiều quân hơn sẽ thắng.'
    ],
    tags: ['chiến thuật', 'hai người', 'kinh điển']
  },
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    vietnameseName: 'Bóng Đá Mặt Bàn',
    description: 'Đẩy puck qua vợt đối thủ và ghi bàn trước khi họ kịp phản công trong trận đấu nhanh giày tính xử lý!',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '🏓',
    color: 'from-cyan-500 to-blue-700',
    controls: ['Di chuyển vợt bằng chuột, ngón tay hoặc phím ← → ↑ ↓', 'Chạm màn hình hoặc nhấn Space để đẩy puck đi nhanh'],
    instructions: [
      'Dùng vợt để đẩy puck vào khung bàn của đối thủ để ghi bàn.',
      'Càng đánh trúng vợt nhiều lần, puck bay càng nhanh và khó kiểm soát hơn.',
      'Póc sân là vùng nguy hiểm: bóng bật ra từ góc sẽ tăng tốc rất mạnh.',
      'Người điểm trước 7 bàn sẽ chiến thắng trận đấu.'
    ],
    tags: ['arcade', 'hai người', 'phản xạ', 'thể thao']
  },
  {
    id: 'fruit-ninja',
    name: 'Fruit Ninja',
    vietnameseName: 'Lời Dao Trái Cây',
    description: 'Dùng lưỡi dao quét chém hết đám trái cây bay lên, tránh bom gai và những quả trượt khỏi màn hình!',
    category: 'arcade',
    difficulty: 'Trung bình',
    icon: '🥭',
    color: 'from-rose-500 to-orange-600',
    controls: ['Quét chuột hoặc ngón tay trên màn hình để chém trái cây', 'Chém 3 quả trong một lần quét để nhiều điểm hơn', 'Chạm nút tạm dừng trên thanh công cụ khi cần nghỉ'],
    instructions: [
      'Một lần quét cắt qua nhiều quả sẽ được nhân điểm, cắt từ 4 quả trở lên thì thời gian chậm lại.',
      'Nếu để một quả rơi khỏi đáy màn hình hoặc chạm phải bom đỏ có gai, bạn sẽ mất một mạng.',
      'Hết mạng là kết thúc ván chơi, càng nhanh tay càng ăn nhiều điểm.',
      'Các đợt tiếp theo trái cây bay nhanh và nhiều hơn.'
    ],
    tags: ['arcade', 'phản xạ', 'bạn hữu']
  },
  {
    id: 'gomoku',
    name: 'Gomoku',
    vietnameseName: 'Cờ Gomoku',
    description: 'Xếp năm quân liền nhau theo hàng, cột hay đường chéo trên bàn 15x15 với đối thủ máy hoặc người chơi.',
    category: 'board',
    difficulty: 'Trung bình',
    icon: '⚪',
    color: 'from-stone-500 to-zinc-800',
    controls: ['Click vào giao điểm trống để đặt quân', 'Nút đi lại để hủy nước vừa rồi', 'Nút chia lại để bắt đầu ván mới'],
    instructions: [
      'Mỗi lượt bạn đặt một quân, mục tiêu là tạo năm quân liền nhau trước đối thủ.',
      'Năm quân liền nhau theo bất kỳ hướng nào: ngang, dọc hoặc chéo đều thắng.',
      'Nếu bàn đầy mà chưa ai có năm quân liền nhau thì hòa.',
      'Chơi với máy sẽ giúp bạn luyện cách chặn đường và dựng hàng tấn công.'
    ],
    tags: ['chiến thuật', 'hai người', 'bút chì', 'kinh điển']
  },
  {
    id: 'mancala',
    name: 'Mancala',
    vietnameseName: 'Cờ Nhặt Quân',
    description: 'Nhặt quân qua các hố bằng cách rải quân và ăn quân của đối thủ vào kho, người nào thu nhiều quân hơn sẽ thắng.',
    category: 'board',
    difficulty: 'Dễ',
    icon: '🥥',
    color: 'from-amber-500 to-orange-800',
    controls: ['Chạm vào một hố thuộc hàng của bạn để nhặt và rải quân', 'Nút đổi chế độ để chơi với máy hoặc hai người'],
    instructions: [
      'Chọn một hố có quân, quân sẽ được rải lần lượt vào các hố kế tiếp theo vòng.',
      'Rơi quân cuối cùng vào kho của bạn thì bạn được đi tiếp ngay.',
      'Rơi quân cuối vào hố trống thuộc hàng mình, nếu hố đối diện có quân thì bạn ăn cả hai.',
      'Hết quân trên một hàng thì phần quân còn lại của hàng đó được quét vào kho.'
    ],
    tags: ['chiến thuật', 'hai người', 'board game']
  },
  {
    id: 'math-duel',
    name: 'Math Duel',
    vietnameseName: 'Đấu Trường Toán',
    description: 'Hai người luân phiên trả lời các câu hỏi toán học cùng nhau, ai nhanh và chính xác hơn sẽ giành chiến thắng.',
    category: 'puzzle',
    difficulty: 'Trung bình',
    icon: '🧮',
    color: 'from-sky-500 to-indigo-700',
    controls: ['Chọn đáp án trên bàn phím số bên dưới để trả lời', 'Chọn mức độ Dễ, Trung bình hoặc Khó trước khi bắt đầu'],
    instructions: [
      'Mỗi câu hỏi có một số giây để trả lời, trả lời đúng và nhanh sẽ ăn nhiều điểm nhất.',
      'Ghi bàn 10 điểm rồi trừ 1 điểm mỗi giây chờ, điểm mỗi câu không bao giờ xuống dưới 2.',
      'Trả lời sai hoặc hết giờ thì câu đó không được điểm.',
      'Độ khó toán học tăng dần theo số câu đã trả lời.'
    ],
    tags: ['toán học', 'thi đấu', 'hai người', 'rèn trí']
  },
  {
    id: 'go',
    name: 'Go',
    vietnameseName: 'Cờ Go',
    description: 'Đặt quân, vây bắt và chiếm đất trên bàn 9x9 với máy đang tính từng nước đi để tìm đường bức thế.',
    category: 'board',
    difficulty: 'Khó',
    icon: '⚫',
    color: 'from-amber-700 to-stone-800',
    controls: ['Chạm vào giao điểm trống để đặt quân', 'Chạm vào quân của bạn đang bị vây 1 lần tự do để nhấc quân lên', 'Nút Bỏ lượt, Gợi ý và Hoàn tác để chơi chậm lại'],
    instructions: [
      'Mục tiêu là chiếm nhiều đất và bắt quân hơn đối thủ, mỗi quân phải còn ít nhất một "hơi" (khoảng trống liền kề).',
      'Đặt quân làm một nhóm quân bị hết hơi thì nhóm quân đối phương bị bắt hoàn toàn.',
      'Không được đặt quân tự bóp chết nhóm của chính mình.',
      'Chấm điểm theo kiểu Trung Quốc: quân trên bàn cộng với số đất bao quanh, bên Trắng được trước 6,5 điểm komi.'
    ],
    tags: ['chiến thuật', 'board game', 'hai người', 'trí tuệ']
  },
  {
    id: 'match-three',
    name: 'Match Three',
    vietnameseName: 'Tam Giác Ngọc',
    description: 'Hoán đổi viên ngọc để tạo hàng ba trở lên, tận dụng chuỗi xếp loại để gom điểm lớn!',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '💎',
    color: 'from-fuchsia-500 to-violet-700',
    controls: ['Chạm một viên ngọc để chọn, chạm viên ngọc kề bên để hoán đổi', 'Chuỗi xếp loại liên tiếp tăng dần điểm nhân'],
    instructions: [
      'Ba viên ngọc cùng màu cùng hàng hoặc cùng cột sẽ biến mất và các viên phía trên rơi xuống.',
      'Một viên ngọc rơi tạo thành chuỗi mới sẽ nhân điểm lên nhiều lần.',
      'Mỗi màn có số lượt đi giới hạn, hoàn thành màn sẽ được thêm lượt đi và thêm một loại ngọc.',
      'Hoàn thành đủ 10 màn là bạn thắng ván chơi, càng nhiều điểm càng tốt.',
      'Khi không còn nước đi nào tạo được bộ ba, bảng sẽ tự đảo lại.'
    ],
    tags: ['casual', 'xếp hình', 'gây nghiện', 'nghỉ tay']
  },
  {
    id: 'stack-tower',
    name: 'Stack Tower',
    vietnameseName: 'Xếp Tháp',
    description: 'Thả từng khối xuống tháp, căn đúng sẽ giữ nguyên độ rộng và nhận chuỗi hoàn hảo cộng thưởng!',
    category: 'arcade',
    difficulty: 'Dễ',
    icon: '🏗️',
    color: 'from-sky-500 to-indigo-700',
    controls: ['Chạm màn hình hoặc nhấn Space / mũi tên lên để thả khối', 'Quan sát vạch hướng dẫn để canh độ rộng của khối bên dưới'],
    instructions: [
      'Khối rơi chồng lên khối dưới, phần thừa sẽ bị cắt bỏ và rơi xuống.',
      'Đặt khối gần đúng vị trí trung tâm sẽ giữ nguyên độ rộng, giúp xây cao hơn.',
      'Xếp chồng chuẩn xác giúp tăng chuỗi và nhận điểm thưởng tăng dần.',
      'Từ tầng thứ sáu trở đi, gió sẽ đẩy khối lệch sang một bên, cần điều chỉnh nhịp thả cho chính xác.'
    ],
    tags: ['arcade', 'tim nhịp', 'điểm cao']
  },
  {
    id: 'tower-of-hanoi',
    name: 'Tower of Hanoi',
    vietnameseName: 'Tháp Hà Nội',
    description: 'Chuyển cả chồng đĩa sang cột bên kia theo đúng luật, càng ít nước đi càng điểm cao!',
    category: 'puzzle',
    difficulty: 'Dễ',
    icon: '🗼',
    color: 'from-rose-500 to-red-700',
    controls: ['Chạm cột nguồn rồi chạm cột đích để chuyển một đĩa', 'Phím 1 2 3 để chọn cột, Z để đi lại, H để xem gợi ý'],
    instructions: [
      'Mỗi lượt chỉ được chuyển một đĩa nằm trên đĩnh cột.',
      'Không bao giờ được đặt một đĩa lớn lên trên đĩa nhỏ hơn.',
      'Mỗi nước đi đúng sẽ được 10 điểm, hãy đi lại nếu chọn nhầm cột.',
      'Đạt đúng số nước tối ưu sẽ nhận thưởng lớn, nên dùng nút "Xem lời giải tối ưu" để học cách xếp đĩa.'
    ],
    tags: ['puzzle', 'logic', 'kinh điển', 'tư duy']
  },
  {
    id: 'word-anagram',
    name: 'Word Anagram',
    vietnameseName: 'Đảo Chữ Nhanh',
    description: 'Sắp xếp các chữ cái bị xáo trộn thành từ tiếng Việt trước khi hết giờ, chuỗi đúng liên tiếp giúp nhân điểm!',
    category: 'casual',
    difficulty: 'Dễ',
    icon: '🔀',
    color: 'from-violet-600 to-fuchsia-700',
    controls: ['Chạm các ô chữ cái để điền vào hàng trả lời', 'Chạm vào ô đã điền để xoá chữ cuối', 'Nút Gợi ý để lộ một chữ đúng, Bỏ qua khi bí từ'],
    instructions: [
      'Mỗi từ đúng mang điểm theo độ dài cộng với thời gian còn lại.',
      'Giải liên tiếp nhiều từ đúng sẽ tăng hệ số điểm lên tối đa x3.',
      'Trả lời sai làm đứt chuỗi và bị trừ điểm, dùng gợi ý cũng bị trừ nhưng nhanh hơn nghĩ.',
      'Hết 60 giây là kết thúc ván chơi.'
    ],
    tags: ['casual', 'từ vựng', 'tiếng việt', 'đồng hồ']
  }
];

export const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: 'Tất cả', icon: '🎮' },
  { id: 'arcade', label: 'Arcade', icon: '⚡' },
  { id: 'puzzle', label: 'Puzzle', icon: '🧩' },
  { id: 'board', label: 'Board Game', icon: '♟️' },
  { id: 'casual', label: 'Casual', icon: '☕' },
  { id: 'strategy', label: 'Chiến thuật', icon: '🧠' },
];

export function getGameById(id: string): GameMetadata | undefined {
  return GAMES.find(g => g.id === id);
}
