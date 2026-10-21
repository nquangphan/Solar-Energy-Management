/**
 * Static clauses of the SALE contract ("HĐ Mua bán") — copied VERBATIM from the company template
 * `docs/2. Thương mại/HDMB CT QTS l2.pdf` (extracted with `pdftotext -layout` on 2026-10-22, PDF
 * line wraps re-joined into paragraphs). Spelling and capitals are the template's own
 * ("Điều 8" is lower-case there); only line wraps and runs of spaces are collapsed.
 *
 * Plain text, not HTML: the template escapes every string. The parts the template fills per order
 * (parties, line table, total, installments, warranty list) are NOT here; the sample's
 * "100% … ngay sau khi ký" payment sentence is replaced by the order's installments, and its two
 * product-specific warranty lines by one line per warranted order line.
 */
export const SALE_CLAUSES = {
  motto: ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc Lập – Tự Do – Hạnh Phúc'],
  mottoRule: '------o0o------',
  title: 'HỢP ĐỒNG MUA BÁN',
  legalBases: [
    '- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 của nước Cộng hòa xã hội chủ nghĩa Việt Nam có hiệu lực từ ngày 01/01/2017;',
    '- Căn cứ Luật Thương mại số 36/2006/QH ngày 14/6/2005 của nước Cộng hoà xã hội chủ nghĩa Việt Nam có hiệu lực từ ngày 01/01/2006;',
    '- Căn cứ vào nhu cầu và năng lực của hai bên.',
  ],
  partyALabel: 'BÊN A (BÊN MUA):',
  partyBLabel: 'BÊN B (BÊN BÁN):',
  agreement:
    'Hai bên đồng ý ký kết hợp đồng kinh tế về việc mua bán hàng hóa với những nội dung, điều khoản cụ thể như sau:',
  article1Heading:
    'ĐIỀU 1: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC VÀ ĐIỀU KIỆN THANH TOÁN',
  article1Value: '1.1. Giá trị hợp đồng',
  article1Method: '1.2. Phương thức thanh toán:',
  article1Transfer:
    '- Bên Mua thanh toán cho Bên Bán bằng hình thức chuyển khoản vào tài khoản do Bên Bán chỉ định.',
  article2Heading: 'ĐIỀU 2: THỜI GIAN VÀ ĐỊA ĐIỂM GIAO HÀNG.',
  article2: [
    '- Thời gian giao hàng: Hàng sẵn kho',
    '- Địa điểm giao hàng: Giao hàng tại kho Bên Bán',
    '- Phương thức giao nhận: Bên Mua tự chịu chi phí và điều động phương tiện vận chuyển đến kho của Bên Bán để nhận hàng.',
    '- Hồ sơ giao hàng gồm có:',
  ],
  article2Documents: [
    'Phiếu giao hàng (01 bản chính)',
    'CO, CQ (01 bản sao y)',
    'Hóa đơn thuế GTGT',
  ],
  article3Heading: 'ĐIỀU 3: TRÁCH NHIỆM CỦA CÁC BÊN.',
  article3: [
    '3.1 Trách nhiệm của bên A',
    '- Bên Mua có trách nhiệm thanh toán và nhận hàng theo đúng thời gian đã quy định.',
    '- Chịu trách nhiệm về mọi rủi ro đối với hàng hóa kể từ thời điểm hàng được bốc lên phương tiện vận chuyển của Bên Mua tại kho Bên Bán.',
    '- Tuân thủ các hướng dẫn sử dụng, bảo quản, bảo trì hàng hoá luôn trong điều kiện tốt nhất trong quá trình sử dụng.',
    '3.2 Trách nhiệm của bên B',
    '- Đảm bảo đầy đủ tính hợp pháp giấy tờ pháp lý của các hàng hoá nói trên.',
    '- Bàn giao cho bên A chi tiết, đầy đủ các trang thiết bị và tài liệu kèm theo.',
    '- Bảo đảm sản phẩm đạt chất lượng theo quy định.',
  ],
  article4Heading: 'ĐIỀU 4: BẢO HÀNH SẢN PHẨM',
  article4Intro: 'Bảo hành sản phẩm:',
  article4BeforeProducts: [
    '- Hàng hóa bảo hành theo tiêu chuẩn của nhà sản xuất',
    '- Thời gian bảo hành được tính từ khi phát hành CQ của lô hàng.',
  ],
  article4AfterProducts: [
    '- Quy định bảo hành nói trên chỉ được áp dụng khi hàng hoá được sử dụng đúng điều kiện và hướng dẫn lắp đặt của nhà sản xuất.',
    '- Hàng hoá sẽ được nhà sản xuất trực tiếp chịu trách nhiệm bảo hành. Bên Bán có trách nhiệm hỗ trợ Bên Mua trong việc làm thủ tục bảo hành với nhà sản xuất.',
    '- Bên Bán sẽ không chịu trách nhiệm hư hỏng nào trong trường hợp: thiên tai, biến cố, môi trường hoạt động không ổn định, hoặc can thiệp sử dụng sai các thiết bị sau khi đã được lắp đặt (thường là do tự ý tháo gỡ và lắp đặt lại không đúng quy định) hoặc là sử dụng trong môi trường không ổn định như: Nhiệt độ cao và ẩm ướt, bụi, côn trùng, quá mức quy định của sản phẩm, tem bảo hành bị rách…',
    '- Quy định bảo hành nói trên chỉ được áp dụng khi hàng hoá được sử dụng đúng điều kiện và hướng dẫn lắp đặt của nhà sản xuất. Hàng hoá sẽ được nhà sản xuất trực tiếp chịu trách nhiệm bảo hành tại kho Bên Bán.',
    '- Bên Bán có trách nhiệm hỗ trợ Bên Mua trong việc làm thủ tục bảo hành với nhà sản xuất.',
    '- Trong vòng 03 ngày làm việc kể từ khi nhận được thông báo của Bên Mua về lỗi hàng hóa, Bên Bán phải phản hồi và tiến hành kiểm tra, khắc phục. Mọi chi phí phát sinh liên quan đến bảo hành trong phạm vi lỗi của Bên Mua sẽ do Bên Mua chịu toàn bộ.',
  ],
  article5Heading: 'ĐIỀU 5: ĐIỀU KHOẢN PHẠT VI PHẠM HỢP ĐỒNG',
  article5: [
    '5.1. Trường hợp Bên Mua chậm thanh toán các đợt theo quy định tại Điều 1.2, Bên Mua phải chịu lãi suất chậm thanh toán là 0,05%/ngày trên số tiền chậm thanh toán.',
    '5.2. Nếu quá 07 ngày kể từ ngày đến hạn thanh toán mà Bên Mua vẫn chưa thanh toán đủ, Bên Bán có quyền tạm dừng giao hàng hoặc đơn phương chấm dứt hợp đồng. Bên Mua phải chịu khoản phạt vi phạm là 5% giá trị hợp đồng.',
    '5.3. Trường hợp Bên Bán chậm giao hàng quá 5 ngày (trừ trường hợp bất khả kháng), Bên Bán phải chịu mức phạt là 0,05%/ngày trên giá trị phần hàng hóa chậm giao.',
    '5.4. Nếu quá 25 ngày kể từ ngày cam kết mà Bên Bán vẫn chưa có hàng tại kho để bàn giao, Bên Mua có quyền đơn phương chấm dứt hợp đồng. Khi đó, Bên Bán phải chịu khoản phạt vi phạm là 5% giá trị hợp đồng.',
  ],
  article6Heading: 'ĐIỀU 6: SỰ KIỆN BẤT KHẢ KHÁNG',
  article6: [
    '6.1. Sự kiện bất khả kháng có nghĩa là bất cứ sự kiện nào xảy ra một cách khách quan, không thể lường trước được và không thể khắc phục được mặc dù đã áp dụng mọi biện pháp cần thiết và khả năng cho phép, khiến một Bên không có khả năng thực hiện nghĩa vụ của mình theo Hợp đồng này, bao gồm nhưng không giới hạn như: sự thay đổi của pháp luật; lệnh cấm đoán của chính phủ hoặc cơ quan nhà nước có thẩm quyền; bạo loạn; chiến tranh; tình trạng khẩn cấp quốc gia; địch họa; bãi công; trừng phạt; cấm vận; tắc nghẽn hay gián đoạn giao thông hoặc các dịch vụ công cộng khác; bệnh dịch; hỏa hoạn; lụt lội; động đất, bão, sóng thần và các sự kiện bất khả kháng khác.',
    '6.2. Bên bị ảnh hưởng bởi Sự kiện bất khả kháng được miễn trừ trách nhiệm thực hiện Hợp đồng mà không bị coi là vi phạm với điều kiện:',
    'a. Sự kiện bất khả kháng là nguyên nhân trực tiếp gây trở ngại cho việc thực hiện các nghĩa vụ theo Hợp đồng.',
    'b. Bên bị ảnh hưởng đã áp dụng các biện pháp cần thiết trong khả năng cho phép để giảm tổn thất cho hai Bên do Sự kiện bất khả kháng gây ra.',
    'c. Chậm nhất trong vòng 03 [ba] ngày kể từ lúc xảy ra Sự kiện bất khả kháng, Bên bị ảnh hưởng có văn bản thông báo cho Bên kia biết về Sự kiện bất khả kháng nêu rõ lý do phải chậm trễ thực hiện hoặc chỉ thực hiện một phần Hợp đồng kèm theo các tài liệu chứng minh về Sự kiện bất khả kháng.',
    '6.3. Hợp đồng sẽ vẫn tiếp tục được thực hiện ngay sau khi Sự kiện bất khả kháng đã chấm dứt, trừ trường hợp Bên bị ảnh hưởng không thể tiếp tục thực hiện do hậu quả của Sự kiện bất khả kháng hoặc Bên không bị ảnh hưởng không còn nhu cầu tiếp tục thực hiện Hợp đồng nữa.',
    '6.4. Trong trường hợp Bên bị ảnh hưởng không thể tiếp tục thực hiện Hợp đồng do hậu quả của Sự kiện bất khả kháng hoặc Bên không bị ảnh hưởng không còn nhu cầu tiếp tục thực hiện Hợp đồng nữa, các Bên có quyền chấm dứt, thanh lý Hợp đồng. Bên chưa thực hiện nghĩa vụ phải hoàn trả các khoản thanh toán đã nhận trước cho Bên đã thanh toán.',
  ],
  article7Heading: 'ĐIỀU 7: GIẢI QUYẾT TRANH CHẤP',
  article7: [
    '7.1. Thương lượng và Hòa giải:',
    'Trong quá trình thực hiện Hợp đồng, nếu phát sinh bất kỳ tranh chấp, khiếu nại nào liên quan đến nội dung hoặc việc thực hiện các điều khoản trong Hợp đồng này, hai bên cam kết ưu tiên giải quyết thông qua thương lượng, hòa giải trên tinh thần hợp tác và tôn trọng quyền lợi của nhau.',
    '7.2. Giải quyết tại Tòa án:',
    'Trong trường hợp tranh chấp không thể giải quyết được bằng thương lượng hoặc hòa giải trong vòng 30 (ba mươi) ngày kể từ ngày phát sinh tranh chấp, một trong các bên có quyền đưa vụ việc ra giải quyết tại Tòa án nhân dân có thẩm quyền tại Thành phố Hồ Chí Minh để giải quyết theo quy định của pháp luật Việt Nam.',
    '7.3. Chi phí tố tụng:',
    'Phán quyết của Tòa án là quyết định cuối cùng và có giá trị cưỡng chế thi hành đối với cả hai bên. Bên thua kiện phải chịu toàn bộ án phí và các chi phí hợp lý khác liên quan đến quá trình tố tụng (bao gồm cả chi phí luật sư nếu có), trừ trường hợp có phán quyết khác của Tòa án.',
    '7.4. Tiếp tục thực hiện hợp đồng:',
    'Trong quá trình giải quyết tranh chấp, các phần khác của Hợp đồng không liên quan trực tiếp đến tranh chấp vẫn phải được hai bên tiếp tục thực hiện đầy đủ, trừ khi hai bên có thỏa thuận tạm dừng hoặc Tòa án có quyết định khác.',
  ],
  article8Heading: 'Điều 8: ĐIỀU KHOẢN CHUNG',
  article8: [
    'Hợp đồng này có hiệu lực thực hiện kể từ ngày ký và được coi là tự động thanh lý khi Bên B đã thanh toán đầy đủ 100% giá trị hợp đồng và Bên A đã bàn giao đầy đủ số lượng tấm pin kèm các chứng từ liên quan (Hóa đơn, CO, CQ).',
    'Hợp đồng này được ký làm 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản',
  ],
  signA: 'ĐẠI DIỆN BÊN A',
  signB: 'ĐẠI DIỆN BÊN B',
} as const;
