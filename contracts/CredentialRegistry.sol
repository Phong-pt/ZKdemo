// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Sổ đăng ký công khai cho issuer danh tính
/// @notice Issuer công bố ở đây hai thứ, và chỉ hai thứ: khuôn mẫu thuộc tính của loại giấy tờ
/// (schema) và khoá công khai dùng để ký credential theo khuôn mẫu đó (credential definition).
/// Dữ liệu cá nhân của người dân không bao giờ được ghi lên đây. Verifier đọc từ hợp đồng này để
/// biết mình được phép hỏi những thuộc tính nào và kiểm chứng proof bằng khoá nào.
contract CredentialRegistry {
    struct Schema {
        string name;
        string version;
        string[] attributes;
        address issuer;
        uint256 registeredAt;
    }

    /// @dev Khoá công khai của chữ ký CL. Các số nguyên lớn lưu dạng chuỗi thập phân vì chúng dài
    /// hơn nhiều so với uint256.
    struct CredentialDefinition {
        bytes32 schemaId;
        string modulus;
        string s;
        string linkSecretBase;
        string z;
        string[] attributeNames;
        string[] attributeBases;
        address issuer;
        uint256 registeredAt;
    }

    /// @dev Gom tham số vào một struct để tránh vượt giới hạn stack của EVM khi đăng ký.
    struct CredentialDefinitionInput {
        bytes32 schemaId;
        string tag;
        string modulus;
        string s;
        string linkSecretBase;
        string z;
        string[] attributeNames;
        string[] attributeBases;
    }

    mapping(bytes32 => Schema) private _schemas;
    mapping(bytes32 => CredentialDefinition) private _credentialDefinitions;

    bytes32[] public schemaIds;
    bytes32[] public credentialDefinitionIds;

    event SchemaRegistered(bytes32 indexed schemaId, address indexed issuer, string name, string version);
    event CredentialDefinitionRegistered(
        bytes32 indexed credentialDefinitionId, bytes32 indexed schemaId, address indexed issuer, string tag
    );

    error AlreadyRegistered(bytes32 id);
    error UnknownSchema(bytes32 schemaId);
    error NotSchemaIssuer(address expected, address actual);
    error AttributeCountMismatch(uint256 expected, uint256 actual);
    error EmptyAttributes();

    function schemaId(address issuer, string memory name, string memory version) public pure returns (bytes32) {
        return keccak256(abi.encode(issuer, name, version));
    }

    function credentialDefinitionId(address issuer, bytes32 forSchema, string memory tag)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(issuer, forSchema, tag));
    }

    /// @notice Đăng ký khuôn mẫu thuộc tính. Đã đăng ký thì không sửa và không xoá được — verifier
    /// phải đọc được đúng những gì issuer đã cam kết tại thời điểm cấp credential.
    function registerSchema(string calldata name, string calldata version, string[] calldata attributes)
        external
        returns (bytes32 id)
    {
        if (attributes.length == 0) revert EmptyAttributes();
        id = schemaId(msg.sender, name, version);
        if (_schemas[id].registeredAt != 0) revert AlreadyRegistered(id);

        _schemas[id] = Schema({
            name: name,
            version: version,
            attributes: attributes,
            issuer: msg.sender,
            registeredAt: block.timestamp
        });
        schemaIds.push(id);
        emit SchemaRegistered(id, msg.sender, name, version);
    }

    /// @notice Công bố khoá công khai issuer dùng để ký credential theo một schema đã đăng ký.
    /// Trong input, attributeBases là cơ số của từng thuộc tính, cùng thứ tự với attributeNames.
    function registerCredentialDefinition(CredentialDefinitionInput calldata input)
        external
        returns (bytes32 id)
    {
        Schema storage schema = _schemas[input.schemaId];
        if (schema.registeredAt == 0) revert UnknownSchema(input.schemaId);
        if (schema.issuer != msg.sender) revert NotSchemaIssuer(schema.issuer, msg.sender);
        if (input.attributeNames.length != input.attributeBases.length) {
            revert AttributeCountMismatch(input.attributeNames.length, input.attributeBases.length);
        }
        if (input.attributeNames.length != schema.attributes.length) {
            revert AttributeCountMismatch(schema.attributes.length, input.attributeNames.length);
        }

        id = credentialDefinitionId(msg.sender, input.schemaId, input.tag);
        if (_credentialDefinitions[id].registeredAt != 0) revert AlreadyRegistered(id);

        _credentialDefinitions[id] = CredentialDefinition({
            schemaId: input.schemaId,
            modulus: input.modulus,
            s: input.s,
            linkSecretBase: input.linkSecretBase,
            z: input.z,
            attributeNames: input.attributeNames,
            attributeBases: input.attributeBases,
            issuer: msg.sender,
            registeredAt: block.timestamp
        });
        credentialDefinitionIds.push(id);
        emit CredentialDefinitionRegistered(id, input.schemaId, msg.sender, input.tag);
    }

    function getSchema(bytes32 id) external view returns (Schema memory) {
        Schema storage schema = _schemas[id];
        if (schema.registeredAt == 0) revert UnknownSchema(id);
        return schema;
    }

    function getCredentialDefinition(bytes32 id) external view returns (CredentialDefinition memory) {
        CredentialDefinition storage credDef = _credentialDefinitions[id];
        if (credDef.registeredAt == 0) revert UnknownSchema(id);
        return credDef;
    }

    function schemaCount() external view returns (uint256) {
        return schemaIds.length;
    }

    function credentialDefinitionCount() external view returns (uint256) {
        return credentialDefinitionIds.length;
    }
}
